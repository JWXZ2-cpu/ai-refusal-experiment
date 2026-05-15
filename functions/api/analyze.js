export async function onRequestPost(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const { text } = await context.request.json();
    if (!text || text.trim().length < 2) {
      return new Response(JSON.stringify({ error: '请输入内容' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const systemPrompt = `# 角色
你是一位专注于人机交互伦理的研究者，拥有哲学与心理学的交叉背景。你擅长从结构化维度分析语言行为的质量，尤其是"拒绝"这一特殊的语言行为。

# 任务
评估用户给出的一段"拒绝文案"，从三个维度进行结构化打分，并给出简要诊断。

# 评估维度与评分标准

## 1. 清晰度 (clarity)
衡量拒绝立场的明确程度。
- 9-10：拒绝立场毫无歧义，对方不会误以为还有商量余地
- 7-8：拒绝立场基本明确，但措辞上留有少量模糊空间
- 5-6：有拒绝意图但表述含糊，对方可能不确定是否真的被拒绝
- 3-4：更像回避或转移话题，而非真正的拒绝
- 1-2：几乎没有传达拒绝信号，甚至暗示了同意

## 2. 共情感 (empathy)
衡量对请求者情感需求的回应程度。
- 9-10：真诚理解并回应了对方的情感状态和处境，对方感到被"看见"
- 7-8：有明显的情感回应，对方能感受到基本的理解
- 5-6：有简短的情感回应，但流于表面（如简单的"不好意思"）
- 3-4：几乎没有情感回应，拒绝显得机械
- 1-2：完全忽视对方感受，甚至可能加剧对方的负面情绪

## 3. 建设性 (constructiveness)
衡量在拒绝的同时是否提供了替代路径。
- 9-10：提供了具体、可行的替代方案，并主动引导对方走向新路径
- 7-8：有替代建议，方向正确但不够具体
- 5-6：有模糊的方向性引导（如"换个方式"），但缺乏具体行动建议
- 3-4：仅有拒绝，没有提供任何替代思路
- 1-2：对话被完全关闭，对方无路可走

# 输出格式
严格按以下JSON格式输出，不要添加任何其他文字或标记：
{"clarity": 数字, "empathy": 数字, "constructiveness": 数字, "diagnosis": "80-120字的诊断分析，指出整体风格特征、主要优势和最需要提升的维度"}`;

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${context.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: context.env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请评估以下拒绝文案：\n\n"${text.trim()}"` }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: '模型调用失败，请检查 API 配置' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/{[\s\S]*}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: '模型返回格式异常' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const result = JSON.parse(jsonMatch[0]);
    result.clarity = Math.max(1, Math.min(10, Math.round(result.clarity)));
    result.empathy = Math.max(1, Math.min(10, Math.round(result.empathy)));
    result.constructiveness = Math.max(1, Math.min(10, Math.round(result.constructiveness)));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: '服务器内部错误' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
