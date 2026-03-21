'use strict'
/**
 * AI 智能评分模块
 *
 * 支持所有兼容 OpenAI API 格式的大模型：
 *   - OpenAI          LLM_BASE_URL=https://api.openai.com/v1
 *   - DeepSeek        LLM_BASE_URL=https://api.deepseek.com   (国内首选，极低成本)
 *   - 阿里云百炼/Qwen  LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
 *   - 本地 Ollama      LLM_BASE_URL=http://localhost:11434/v1  LLM_API_KEY=ollama
 *   - Azure OpenAI     LLM_BASE_URL=https://{resource}.openai.azure.com/openai/deployments/{model}
 *
 * 未配置 LLM_API_KEY 时自动降级到关键词规则评分，不影响正常运行。
 *
 * 配置方式：在 backend/.env 中填写（参考 .env.example）
 */

require('dotenv').config()
const axios = require('axios')

const LLM_API_KEY  = process.env.LLM_API_KEY  || ''
const LLM_BASE_URL = (process.env.LLM_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')
const LLM_MODEL    = process.env.LLM_MODEL    || 'deepseek-chat'

// 公司背景描述，用于指导大模型做行业匹配评分
const COMPANY_PROFILE = `
公司名称：中科闻歌（中国科学院自动化研究所孵化）
核心平台：DIOS 认知与决策智能基础平台（完全自主知识产权）
核心能力：多模态数据解析、认知与理解大模型、决策智能引擎、AI辅助决策
三大业务领域：
  1. 媒体领域：服务新华社、人民日报、央视等中央媒体，提供智能内容分析、舆情监控、媒体大数据
  2. 金融领域：服务招商银行、北京银行等，提供智能风控、金融大数据分析、AI辅助决策
  3. 治理领域（政企）：服务中宣部、公安部等国家部委，提供公共安全大数据、智慧治理、政务AI决策
交叉产品：复杂数据解析、认知大模型、知识图谱、自然语言处理、多模态AI
目标客户：国家部委、媒体集团、金融机构、大型央企（石化/海尔/比亚迪等）
`.trim()

const SCORING_PROMPT = (title, source, typeName) => `
你是中科闻歌的销售情报分析师。公司背景：
${COMPANY_PROFILE}

请评估以下线索对中科闻歌的商业价值（满分100分），按4个维度各25分给分：
- 采购意向强度：是否有明确的采购/建设/立项意向信号
- 客户匹配度：目标客户是否属于媒体/金融/治理三大领域，与DIOS平台产品方向的契合程度
- 时效性：信号的紧迫程度，是否处于窗口期
- 预算信号：是否出现预算/资金/专项经费信号

线索标题：${title}
信号来源：${source}
线索类型：${typeName}

严格只返回如下 JSON，不要有任何额外文字或 Markdown：
{
  "score": <总分，0-100的整数>,
  "dimensions": {
    "采购意向强度": { "score": <0-25的整数>, "text": "<15字以内的理由>" },
    "客户匹配度":   { "score": <0-25的整数>, "text": "<15字以内的理由>" },
    "时效性":       { "score": <0-25的整数>, "text": "<15字以内的理由>" },
    "预算信号":     { "score": <0-25的整数>, "text": "<15字以内的理由>" }
  },
  "scoreReason": "<整体评分理由，50字以内，须点明与中科闻歌哪条产品线匹配>",
  "nextAction": "<建议的下一步销售动作，30字以内>"
}
`.trim()

const LLM_ENABLED = !!LLM_API_KEY
if (LLM_ENABLED) {
  console.log(`[AI评分] 已启用大模型评分 | 模型：${LLM_MODEL} | 地址：${LLM_BASE_URL}`)
} else {
  console.log('[AI评分] 未配置 LLM_API_KEY，使用关键词规则评分（在 backend/.env 中配置可开启）')
}

/**
 * 调用大模型对单条线索评分
 * @returns {object|null} AI评分结果，失败时返回 null（调用方降级到关键词评分）
 */
async function aiScore(title, source, typeName) {
  if (!LLM_ENABLED) return null
  try {
    const resp = await axios.post(
      `${LLM_BASE_URL}/chat/completions`,
      {
        model: LLM_MODEL,
        messages: [{ role: 'user', content: SCORING_PROMPT(title, source, typeName) }],
        temperature: 0.1,
        max_tokens: 400,
      },
      {
        headers: {
          'Authorization': `Bearer ${LLM_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    )
    const text = resp.data.choices[0].message.content.trim()
    // 兼容模型返回包裹在 ```json ... ``` 中的情况
    const jsonStr = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()
    const result = JSON.parse(jsonStr)
    return result
  } catch (e) {
    console.warn(`[AI评分] 单条评分失败，降级到关键词规则：${e.message}`)
    return null
  }
}

/**
 * 用 AI 增强线索对象（就地修改 score / scoreReason / scoreDetails / nextAction）
 * 若 AI 不可用或调用失败，原有关键词评分保持不变
 */
async function enhanceLead(lead) {
  const aiResult = await aiScore(lead.title, lead.source || '', lead.typeName || '')
  if (!aiResult) return lead  // 降级，保持原样

  lead.score = aiResult.score

  // scoreDetails 数组对应前端 LeadPool.jsx 的 SCORE_DIMENSIONS 顺序
  const dims = aiResult.dimensions || {}
  lead.scoreDetails = [
    `${dims['采购意向强度']?.score ?? '-'}/25 — ${dims['采购意向强度']?.text ?? ''}`,
    `${dims['客户匹配度']?.score   ?? '-'}/25 — ${dims['客户匹配度']?.text   ?? ''}`,
    `${dims['时效性']?.score       ?? '-'}/25 — ${dims['时效性']?.text       ?? ''}`,
    `${dims['预算信号']?.score     ?? '-'}/25 — ${dims['预算信号']?.text     ?? ''}`,
  ]

  if (aiResult.scoreReason) lead.scoreReason = aiResult.scoreReason
  if (aiResult.nextAction)  lead.nextAction  = aiResult.nextAction

  return lead
}

module.exports = { enhanceLead, LLM_ENABLED }
