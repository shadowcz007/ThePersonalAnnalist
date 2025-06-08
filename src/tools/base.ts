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

  const recordTool = {
    name: 'record_' + config.name,
    description: config.description,
    fields: config.fields,
    handler: async (args: any, client: any, sendNotification: any) => {
      // 打印工具参数
      console.log('工具参数:', args)

      // TODO: 在这里实现工具逻辑
      const { createDatabase } = client

      const currentDb = await createDatabase(globalThis.databasePath)

      // 确保表存在
      currentDb.run(`CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ${fieldDefs}
      )`)

      // 动态组装插入参数
      const insertParams = { ...fieldInsertParams }
      for (const key of fieldNames) {
        insertParams[`$${key}`] = args[key]
      }

      const stmt = currentDb.prepare(
        `INSERT INTO ${tableName} (${fieldNames.join(', ')}) VALUES (${fieldNames.map(f => `$${f}`).join(', ')})`
      )
      stmt.run(insertParams)
      stmt.free()
      currentDb._saveDBFile()

      return {
        content: [
          {
            type: 'text',
            text: `完成记录`
          }
        ]
      }
    }
  }

  const queryTool = {
    name: 'query_' + tableName,
    description: `通过自定义SQL语句查询数据库 ${tableName} 表,关键字段为 ${fieldNames.join(', ')}`,
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
            text: `查询结果: ${JSON.stringify(result)},所有表: ${JSON.stringify(
              result2
            )}${errorInfo ? `,SQL执行出错: ${errorInfo}` : ''}`
          }
        ]
      }
    }
  }

  return {
    record: recordTool,
    query: queryTool
  }
}
