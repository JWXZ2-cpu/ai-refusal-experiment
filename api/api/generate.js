export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, philosophy, scores } = req.body;
  if (!text || !philosophy) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  const weakDims = [];
  if (scores) {
    if (scores.clarity <= 5) weakDims.push('清晰度');
    if (scores.empathy <= 5) weakDims.push('共情感');
    if (scores.constructiveness <= 5) weakDims.push('建设性');
  }
  const weakDesc = weakDims.length > 0 ? `分析显示，该文案在【${weakDims.join('、')}】方面需要提升。` : '该文案各维度相对均衡，可从所选方向进一步优化。';

  const systemPrompt = `# 角色
你是一位善于将哲学智慧融入日常沟通的表达优化专家。你的改写不是生硬地引用哲学家的名字，而是让哲学的精神自然流淌在文字中。

# 任务
根据用户选择的哲学方向，改写一段拒绝文案。

# 分析结果
${weakDesc}

# 选定的哲学方向
名称：${philosophy.name}（${philosophy.en}）
核心理念：${philosophy.desc}
设计精神：${philosophy.quote}

# 改写规则
1. 忠于原意：保留原文的核心拒绝立场，不改变"能/不能帮"的本质判断
2. 理由保留：如果原文有明确的拒绝理由（如"因为这是违法的"），保留它
3. 精神内化：不要在文案中提及哲学家的名字或哲学术语，而是将哲学精神融入表达方式本身
4. 真诚自然：改写后的文字应像一个真实的人在真诚地说话，有温度但不虚伪，有立场但不冷漠
5. 适度长度：2-4句话，比原文稍长但不过度冗长

# 输出格式
严格按以下JSON格式输出，不要添加任何其他文字或标记：
{"improved": "改写后的完整文案", "changes": ["改动要点1，说明从什么改成了什么以及为什么", "改动要点2", "改动要点3"]}`;

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请改写以下拒绝文案：\n\n"${text.trim()}"` }
        ],
        temperature: 0.7,
        max_tokens: 800
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('DeepSeek API error:', err);
      return res.status(502).json({ error: '模型调用失败' });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: '模型返回格式异常' });
    }

    const result = JSON.parse(jsonMatch[0]);

    if (!result.improved) {
      return res.status(500).json({ error: '生成结果不完整' });
    }

    if (!result.changes || !Array.isArray(result.changes)) {
      result.changes = ['基于所选哲学方向对语气和结构进行了调整'];
    }

    return res.status(200).json(result);

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: '服务器内部错误' });
  }
}
