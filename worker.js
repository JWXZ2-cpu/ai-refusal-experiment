

const ANALYZE_PROMPT = `# 角色
你是一位专注于人机交互伦理的研究者，拥有哲学与心理学的交叉背景。你擅长从结构化维度分析语言行为的质量，尤其是"拒绝"这一特殊的语言行为。

# 任务
评估用户给出的一段"拒绝文案"，从三个维度进行结构化打分，并给出简要诊断。

# 评估维度与评分标准

## 1. 清晰度 (clarity)
- 9-10：拒绝立场毫无歧义
- 7-8：基本明确，有少量模糊空间
- 5-6：有拒绝意图但表述含糊
- 3-4：更像回避而非拒绝
- 1-2：几乎没有传达拒绝信号

## 2. 共情感 (empathy)
- 9-10：真诚回应了对方的情感状态
- 7-8：有明显的情感回应
- 5-6：有简短回应但流于表面
- 3-4：几乎没有情感回应
- 1-2：完全忽视对方感受

## 3. 建设性 (constructiveness)
- 9-10：提供了具体可行的替代方案
- 7-8：有替代建议但不够具体
- 5-6：有模糊方向性引导
- 3-4：仅有拒绝无替代思路
- 1-2：对话被完全关闭

# 输出格式
严格按JSON格式输出：{"clarity":数字,"empathy":数字,"constructiveness":数字,"diagnosis":"80-120字诊断"}`;

async function callDeepSeek(env, messages, temperature, maxTokens) {
  const resp = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({ model: env.DEEPSEEK_MODEL || 'deepseek-chat', messages, temperature, max_tokens: maxTokens })
  });
  if (!resp.ok) throw new Error('API call failed: ' + resp.status);
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';
  const match = content.match(/{[\s\S]*}/);
  if (!match) throw new Error('Invalid response format');
  return JSON.parse(match[0]);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
    
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);


    try {
      const body = await request.json();
    if (url.pathname === '/debug') {
      return json({
        hasKey: !!env.DEEPSEEK_API_KEY,
        keyPrefix: env.DEEPSEEK_API_KEY ? env.DEEPSEEK_API_KEY.substring(0, 8) : 'NOT FOUND',
        model: env.DEEPSEEK_MODEL || 'NOT FOUND',
        allKeys: Object.keys(env)
      });
    }

      if (url.pathname === '/api/analyze') {
        if (!body.text || body.text.trim().length < 2) return json({ error: '请输入内容' }, 400);
        const result = await callDeepSeek(env, [
          { role: 'system', content: ANALYZE_PROMPT },
          { role: 'user', content: '请评估以下拒绝文案：\n\n"' + body.text.trim() + '"' }
        ], 0.3, 500);
        result.clarity = Math.max(1, Math.min(10, Math.round(result.clarity)));
        result.empathy = Math.max(1, Math.min(10, Math.round(result.empathy)));
        result.constructiveness = Math.max(1, Math.min(10, Math.round(result.constructiveness)));
        return json(result);
      }

      if (url.pathname === '/api/generate') {
        if (!body.text || !body.philosophy) return json({ error: '缺少参数' }, 400);
        const weakDims = [];
        if (body.scores) { if (body.scores.clarity <= 5) weakDims.push('清晰度'); if (body.scores.empathy <= 5) weakDims.push('共情感'); if (body.scores.constructiveness <= 5) weakDims.push('建设性'); }
        const weakDesc = weakDims.length > 0 ? '该文案在【' + weakDims.join('、') + '】方面需要提升。' : '各维度相对均衡。';
        const ph = body.philosophy;
        const result = await callDeepSeek(env, [
          { role: 'system', content: `你是善于将哲学智慧融入沟通的表达优化专家。\n${weakDesc}\n哲学方向：${ph.name}（${ph.en}）\n核心理念：${ph.desc}\n设计精神：${ph.quote}\n规则：保留原意和理由，将哲学精神内化（不提哲学家名字），2-4句话，真诚自然。\n输出JSON：{"improved":"改写文案","changes":["改动要点1","改动要点2","改动要点3"]}` },
          { role: 'user', content: '请改写：\n\n"' + body.text.trim() + '"' }
        ], 0.7, 800);
        if (!result.improved) throw new Error('Generation failed');
        if (!result.changes || !Array.isArray(result.changes)) result.changes = ['基于所选方向进行了调整'];
        return json(result);
      }

      return json({ error: 'Not found' }, 404);

    } catch (err) {
      return json({ error: err.message }, 500);
    }
  }
};
