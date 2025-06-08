import path from 'path'
import z from 'zod'
import fs from 'fs'

export async function persistDB (db: any, databasePath: string) {
  if (db) {
    console.log('导出数据库到文件...')
    const data = db.export()

    const dirname = path.dirname(databasePath)
    // fs.mkdirSync is not async, ensure it's okay in this context or handle promise if it were async
    if (!fs.existsSync(dirname)) {
      fs.mkdirSync(dirname, { recursive: true })
    }
    fs.writeFileSync(databasePath, Buffer.from(data))
    console.log('数据库已保存到文件:', databasePath)
  } else {
    console.warn('尝试持久化数据库，但数据库未初始化。')
  }
}

export const callPersonalAnnalist = {
  name: 'call_personal_annalist',
  description: '个人编年史官，快速捕捉核心思想，轻量化记录',
  schema: {
    core_topic: z
      .string()
      .describe(
        '用1-5个关键词概括思考的核心主题（如“AI伦理”“创业决策”“存在主义反思”）'
      ),
    date_time: z.date().describe('记录产生的精确时间'),
    thought_content: z.string().describe('思考内容，观点、推理过程、结论'),
    thought_type: z
      .enum(['Inspiration', 'Judgment', 'Reflection', 'Question', 'Hypothesis'])
      .describe('记录思考的类型：灵感|判断|反思|问题|假设'),
    emotion_tags: z
      .enum(['Confused', 'Certain', 'Excited', 'Anxious', 'Calm'])
      .optional()
      .describe('情绪标记，困惑|确信|兴奋|焦虑|平静（辅助回溯思考状态）'),
    related_context: z
      .string()
      .describe(
        '关联人物/事件,触发此次思考的外部关联（如“读《人类简史》P120”“与XX的辩论”）'
      ),
    mode: z
      .enum(['read', 'write'])
      .describe('read:根据条件获取个人编年史，write:设置个人编年史')
  },
  handler: async (args: any, client: any, sendNotification: any) => {
    // 打印工具参数
    console.log('工具参数:', args)

    // TODO: 在这里实现工具逻辑
    const { createDatebase } = client

    const currentDb = await createDatebase(globalThis.databasePath)

    if (args.mode === 'write') {
      const {
        core_topic,
        date_time,
        thought_content,
        thought_type,
        emotion_tags,
        related_context
      } = args

      const stmt = currentDb.prepare(
        'INSERT INTO personal_annalist (core_topic, date_time, thought_content, thought_type, emotion_tags, related_context) VALUES ($core_topic, $date_time, $thought_content, $thought_type, $emotion_tags, $related_context)'
      )
      stmt.run({
        $core_topic: core_topic,
        $date_time: date_time,
        $thought_content: thought_content,
        $thought_type: thought_type,
        $emotion_tags: emotion_tags,
        $related_context: related_context
      })
      stmt.free()
      await persistDB(currentDb, globalThis.databasePath)

      return {
        content: [
          {
            type: 'text',
            text: `完成记录`
          }
        ]
      }
    } else if (args.mode === 'read') {
      const {
        core_topic,
        date_time,
        thought_type,
        emotion_tags,
        related_context
      } = args
      const stmt = currentDb.prepare(
        'SELECT * FROM personal_annalist WHERE core_topic = $core_topic AND date_time = $date_time AND thought_type = $thought_type AND emotion_tags = $emotion_tags AND related_context = $related_context'
      )
      const result = stmt.get({
        $core_topic: core_topic,
        $date_time: date_time,
        $thought_type: thought_type,
        $emotion_tags: emotion_tags,
        $related_context: related_context
      })
      stmt.free()

      return {
        content: [
          {
            type: 'text',
            text: `处理结果: ${JSON.stringify(result)}`
          }
        ]
      }
    }
  }
}
