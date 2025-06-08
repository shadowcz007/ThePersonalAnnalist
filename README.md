这是一个[mcp-plugin](https://www.npmjs.com/package/mcp-plugin)的项目，需配合[mcp-server-exe](https://github.com/shadowcz007/mcp_server_exe)使用。

# The Personal Annalist
旨在为用户构建一部深度、结构化、可回溯的个人思想传记

---

### **基础版**  
**目标：快速捕捉核心思想，轻量化记录**  
| 字段                | 类型         | 必填 | 说明                                                                 |
|---------------------|--------------|------|----------------------------------------------------------------------|
| **日期与时间**      | 时间戳       | ✓    | 记录产生的精确时间（自动/手动）                                       |
| **核心主题**        | 短文本       | ✓    | 用1-5个关键词概括思考的核心主题（如“AI伦理”“创业决策”“存在主义反思”） |
| **思考内容**        | 长文本       | ✓    | 自由书写观点、推理过程、结论                                         |
| **思考类型**        | 单选标签     | ✓    | `灵感` \| `判断` \| `反思` \| `问题` \| `假设`                        |
| **情绪标记**        | 多选标签     | ✗    | `困惑` \| `确信` \| `兴奋` \| `焦虑` \| `平静`（辅助回溯思考状态）     |
| **关联人物/事件**   | 短文本       | ✗    | 触发此次思考的外部关联（如“读《人类简史》P120”“与XX的辩论”）          |

> **特点**：极简高效，5分钟内完成记录，适合碎片化思考捕捉。

```
**Date & Time**: 2025-06-08 14:30  
**Core Topic**: AI Bias, Fairness  
**Thought Content**: "Current LLMs amplify stereotypes because... [reasoning]... Solution: adversarial training."  
**Thought Type**: Judgment  
**Emotion Tags**: Certain, Anxious  
**Related Context**: "MIT Tech Review article on bias audits"  
```
