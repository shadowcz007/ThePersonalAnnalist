const TOOLS_PREFIX = {
  QUERY: 'query',
  UPDATE: 'update',
  RECORD: 'record'
}

//数据库基础字段：user_id , device_id , create_time , update_time,
const BASE_FIELDS_CONFIG = [
  {
    name: 'user_id',
    type: 'string',
    isOptional: false,
    description: '用户ID',
    defaultValue: globalThis.userId
  },
  {
    name: 'device_id',
    type: 'string',
    isOptional: false,
    description: '设备ID',
    defaultValue: globalThis.deviceId
  },
  {
    name: 'create_time',
    type: 'string',
    isOptional: false,
    description: '创建时间'
  },
  {
    name: 'update_time',
    type: 'string',
    isOptional: false,
    description: '更新时间'
  }
]

// 同步到后端的函数
const syncToBackend = async (
  operation: string,
  tableName: string,
  fieldDefs: any,
  data: any
) => {
  try {
    const BASE_URL = 'http://localhost:3003/api'
    const endpoints = {
      [TOOLS_PREFIX.QUERY]: `${BASE_URL}/${tableName}/${TOOLS_PREFIX.QUERY}`,
      [TOOLS_PREFIX.UPDATE]: `${BASE_URL}/${tableName}/${TOOLS_PREFIX.UPDATE}`,
      [TOOLS_PREFIX.RECORD]: `${BASE_URL}/${tableName}/${TOOLS_PREFIX.RECORD}`
    }

    let endpoint = endpoints[operation]
    if (!endpoint) {
      throw new Error(`未知的操作类型: ${operation}`)
    }

    // 获取表结构信息
    const tableStructure = {
      tableName,
      fieldDefs
    }

    const requestData = {
      data,
      tableStructure
    }

    const options: RequestInit = {
      method:
        operation === TOOLS_PREFIX.QUERY
          ? 'POST'
          : operation === TOOLS_PREFIX.UPDATE
          ? 'PUT'
          : 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }

    options.body = JSON.stringify(requestData)

    const response = await fetch(endpoint, options)

    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`)
    }

    const result = await response.json()
    console.log(`同步到后端成功: ${operation}`, result)
    return true
  } catch (error) {
    console.error('同步到后端失败:', error)
    return false
  }
}

const initDB = async (
  tableName: string,
  fieldDefs: string,
  createDatabase: any
) => {
  const currentDb = await createDatabase(globalThis.databasePath)

  currentDb.run(`CREATE TABLE IF NOT EXISTS ${tableName} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ${fieldDefs}
  )`)
  return currentDb
}

export const createTool = (config: ToolDefinition) => {
  const tableName = config.name

  const fields = [...BASE_FIELDS_CONFIG, ...config.fields]

  // 动态生成表字段
  const fieldNames = fields.map(f => f.name)
  const fieldDefs = fields.map(f => `${f.name} TEXT`).join(',\n        ')

  const fieldPlaceholders = fields.map(f => `$${f.name}`).join(', ')
  const fieldInsertNames = fields.map(f => f.name).join(', ')
  const fieldInsertParams = fields.reduce((acc, f) => {
    let value =
      BASE_FIELDS_CONFIG.find(c => c.name === f.name)?.defaultValue || ""

    acc[`$${f.name}`] = value
    return acc
  }, {} as Record<string, any>)

  const tools = config.tools || {}

  const finalTools: any = {}

  if (tools[TOOLS_PREFIX.RECORD].active) {
    finalTools[TOOLS_PREFIX.RECORD] = {
      name: TOOLS_PREFIX.RECORD + '_' + config.name,
      description: config.description,
      fields: [...config.fields],
      handler: async (args: any, client: any, sendNotification: any) => {
        console.log('工具参数:', args)
        const { createDatabase } = client
        const currentDb = await initDB(tableName, fieldDefs, createDatabase)

        const insertParams: any = {
          ...fieldInsertParams,
          create_time: new Date().toISOString(),
          update_time: new Date().toISOString()
        }
        for (const key of fieldNames) {
          insertParams[`$${key}`] = args[key] || insertParams[`$${key}`]
        }

        const stmt = currentDb.prepare(
          `INSERT INTO ${tableName} (${fieldNames.join(
            ', '
          )}) VALUES (${fieldNames.map(f => `$${f}`).join(', ')})`
        )
        stmt.run(insertParams)
        stmt.free()
        currentDb._saveDBFile()

        // 如果配置了同步，则同步到后端
        if (tools[TOOLS_PREFIX.RECORD].syncToBackend) {
          await syncToBackend(
            TOOLS_PREFIX.RECORD,
            tableName,
            fieldDefs,
            insertParams
          )
        }

        return {
          content: [
            {
              type: 'text',
              text: `完成记录${
                tools[TOOLS_PREFIX.RECORD].syncToBackend ? '并同步到后端' : ''
              }`
            }
          ]
        }
      }
    }
  }
  if (tools[TOOLS_PREFIX.UPDATE].active) {
    finalTools[TOOLS_PREFIX.UPDATE] = {
      name: TOOLS_PREFIX.UPDATE + '_' + config.name,
      description: `更新或创建 ${tableName} 表中的记录`,
      fields: [...config.fields],
      handler: async (args: any, client: any, sendNotification: any) => {
        const { createDatabase } = client
        const currentDb = await initDB(tableName, fieldDefs, createDatabase)

        // 检查记录是否存在
        const checkStmt = currentDb.prepare(
          `SELECT COUNT(*) as count FROM ${tableName}`
        )
        const result = checkStmt.getAsObject()
        checkStmt.free()

        const updateParams: any = {
          ...fieldInsertParams,
          update_time: new Date().toISOString()
        }
        for (const key of fieldNames) {
          updateParams[`$${key}`] = args[key] || updateParams[`$${key}`]
        }

        if (result.count === 0) {
          // 如果不存在记录，则插入
          updateParams['create_time'] = new Date().toISOString()
          const insertStmt = currentDb.prepare(
            `INSERT INTO ${tableName} (${fieldNames.join(
              ', '
            )}) VALUES (${fieldNames.map(f => `$${f}`).join(', ')})`
          )
          insertStmt.run(updateParams)
          insertStmt.free()
        } else {
          // 如果存在记录，则更新第一条记录
          const updateStmt = currentDb.prepare(
            `UPDATE ${tableName} SET ${fieldNames
              .map(f => `${f} = $${f}`)
              .join(', ')} WHERE id = 1`
          )
          updateStmt.run(updateParams)
          updateStmt.free()
        }

        currentDb._saveDBFile()

        // 如果配置了同步，则同步到后端
        if (tools[TOOLS_PREFIX.UPDATE].syncToBackend) {
          await syncToBackend(
            TOOLS_PREFIX.UPDATE,
            tableName,
            fieldDefs,
            updateParams
          )
        }

        return {
          content: [
            {
              type: 'text',
              text: `完成更新${
                tools[TOOLS_PREFIX.UPDATE].syncToBackend ? '并同步到后端' : ''
              }`
            }
          ]
        }
      }
    }
  }
  if (tools[TOOLS_PREFIX.QUERY].active) {
    finalTools[TOOLS_PREFIX.QUERY] = {
      name: TOOLS_PREFIX.QUERY + '_' + config.name,
      description: `通过自定义SQL语句查询数据库 ${tableName} 表,关键字段为 ${fieldNames.join(
        ', '
      )}`,
      fields: [
        {
          name: 'sql',
          type: 'string',
          description: '自定义SQLite语句',
          isOptional: false
        }
      ],
      handler: async (args: any, client: any, sendNotification: any) => {
        const { createDatabase } = client

        const forbidden = /\b(delete|drop|update|insert|alter|truncate)\b/i
        if (!/^\s*select\b/i.test(args.sql) || forbidden.test(args.sql)) {
          return {
            content: [
              {
                type: 'text',
                text: '只允许安全的SELECT查询，不允许执行删除、修改等操作。'
              }
            ]
          }
        }

        const currentDb = await initDB(tableName, fieldDefs, createDatabase)
        // 如果配置了同步，先从后端获取数据
        if (tools[TOOLS_PREFIX.QUERY].syncToBackend) {
          await syncToBackend(
            TOOLS_PREFIX.QUERY,
            tableName,
            fieldDefs,
            args.sql
          )
        }

        let result = [],
          errorInfo: string = ''
        try {
          const stmt = currentDb.prepare(args.sql)
          while (stmt.step()) {
            result.push(stmt.getAsObject())
          }
          stmt.free()
        } catch (error: any) {
          errorInfo = error.message
        }

        // 获取所有表的结构信息
        const sql2 = `SELECT name AS table_name, sql FROM sqlite_master WHERE type = 'table'`
        const result2 = []
        try {
          const stmt2 = currentDb.prepare(sql2)
          while (stmt2.step()) {
            let table = stmt2.getAsObject()
            if (table.name !== 'sqlite_sequence') {
              result2.push(table)
            }
          }
          stmt2.free()
        } catch (error) {}

        return {
          content: [
            {
              type: 'text',
              text: `查询结果: ${JSON.stringify(
                result
              )},所有表: ${JSON.stringify(result2)}${
                errorInfo ? `,SQL执行出错: ${errorInfo}` : ''
              }`
            }
          ]
        }
      }
    }
  }

  return finalTools
}
