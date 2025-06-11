const TOOLS_PREFIX = {
  QUERY: 'query',
  UPDATE: 'update',
  RECORD: 'record'
}

// 同步到后端的函数
const syncToBackend = async (operation: string, data: any) => {
  try {
    // TODO: 实现实际的API调用
    const mockApi = {
      [TOOLS_PREFIX.QUERY]: `GET /api/${TOOLS_PREFIX.QUERY}`,
      [TOOLS_PREFIX.UPDATE]: `PUT /api/${TOOLS_PREFIX.UPDATE}`,
      [TOOLS_PREFIX.RECORD]: `POST /api/${TOOLS_PREFIX.RECORD}`
    }
    console.log(`同步到后端: ${mockApi[operation]}`, data)
    return true
  } catch (error) {
    console.error('同步到后端失败:', error)
    return false
  }
}

export const createTool = (config: ToolDefinition) => {
  const tableName = config.name

  // 动态生成表字段
  const fieldNames = config.fields.map(f => f.name)
  const fieldDefs = config.fields.map(f => `${f.name} TEXT`).join(',\n        ')
  const fieldPlaceholders = config.fields.map(f => `$${f.name}`).join(', ')
  const fieldInsertNames = config.fields.map(f => f.name).join(', ')
  const fieldInsertParams = config.fields.reduce((acc, f) => {
    acc[`$${f.name}`] = undefined
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
        const currentDb = await createDatabase(globalThis.databasePath)

        currentDb.run(`CREATE TABLE IF NOT EXISTS ${tableName} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ${fieldDefs}
        )`)

        const insertParams = { ...fieldInsertParams }
        for (const key of fieldNames) {
          insertParams[`$${key}`] = args[key]
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
          await syncToBackend(TOOLS_PREFIX.RECORD, insertParams)
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
        const currentDb = await createDatabase(globalThis.databasePath)

        // 确保表存在
        currentDb.run(`CREATE TABLE IF NOT EXISTS ${tableName} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ${fieldDefs}
        )`)

        // 检查记录是否存在
        const checkStmt = currentDb.prepare(
          `SELECT COUNT(*) as count FROM ${tableName}`
        )
        const result = checkStmt.getAsObject()
        checkStmt.free()

        const updateParams = { ...fieldInsertParams }
        for (const key of fieldNames) {
          updateParams[`$${key}`] = args[key]
        }

        if (result.count === 0) {
          // 如果不存在记录，则插入
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
          await syncToBackend(TOOLS_PREFIX.UPDATE, updateParams)
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
        const currentDb = await createDatabase(globalThis.databasePath)

        // 如果配置了同步，先从后端获取数据
        if (tools[TOOLS_PREFIX.QUERY].syncToBackend) {
          await syncToBackend(TOOLS_PREFIX.QUERY, {})
        }

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
