import z from 'zod'

const tableName = 'personal_annalist'

export const record = {
  name: 'record_personal_thought',
  description: '个人编年史官，快速捕捉核心思想，轻量化记录',
  schema: {
    core_topic: z
      .string()
      .describe(
        '用1-5个关键词概括思考的核心主题（如"AI伦理" "创业决策" "存在主义反思"）'
      ),
    thought_content: z.string().describe('思考内容，观点、推理过程、结论'),
    thought_type: z
      .enum(['Inspiration', 'Judgment', 'Reflection', 'Question', 'Hypothesis'])
      .describe(
        '记录思考的类型：Inspiration, Judgment, Reflection, Question, Hypothesis'
      ),
    emotion_tags: z
      .enum(['Confused', 'Certain', 'Excited', 'Anxious', 'Calm'])
      .optional()
      .describe(
        '情绪标记,辅助回溯思考状态，Confused, Certain, Excited, Anxious, Calm'
      ),
    related_context: z
      .string()
      .describe(
        '关联人物/事件,触发此次思考的外部关联（如"读《人类简史》P120" "与XX的辩论"）'
      )
  },
  handler: async (args: any, client: any, sendNotification: any) => {
    // 打印工具参数
    console.log('工具参数:', args)

    // TODO: 在这里实现工具逻辑
    const { createDatabase } = client

    const currentDb = await createDatabase(globalThis.databasePath)

    // 确保personal_annalist表存在
    currentDb.run(`CREATE TABLE IF NOT EXISTS ${tableName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      core_topic TEXT,
      date_time TEXT,
      thought_content TEXT,
      thought_type TEXT,
      emotion_tags TEXT,
      related_context TEXT
    )`)

    const {
      core_topic,
      thought_content,
      thought_type,
      emotion_tags,
      related_context
    } = args

    const stmt = currentDb.prepare(
      `INSERT INTO ${tableName} (core_topic, date_time, thought_content, thought_type, emotion_tags, related_context) VALUES ($core_topic, $date_time, $thought_content, $thought_type, $emotion_tags, $related_context)`
    )
    stmt.run({
      $core_topic: core_topic,
      $date_time: new Date().toISOString(),
      $thought_content: thought_content,
      $thought_type: thought_type,
      $emotion_tags: emotion_tags,
      $related_context: related_context
    })
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

export const query = {
  name: 'query_personal_annalist',
  description: `通过自定义SQL语句查询个人编年史数据库 ${tableName} 表,关键字段为 core_topic, date_time, thought_content, thought_type, emotion_tags, related_context`,
  schema: {
    sql: z
      .string()
      .describe(
        '要执行的SQL查询语句，只允许安全的SELECT查询，不允许执行删除、修改等操作。'
      )
  },
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
