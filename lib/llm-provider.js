/* ============================================================================
 * QARAR — LLM PROVIDER ADAPTER
 * محوّل مزود الذكاء الاصطناعي — معزول وقابل للاستبدال
 * ============================================================================
 *
 * 🔒 هذا الملف يعمل على السيرفر فقط (Vercel Serverless Function).
 *    لا يصل إلى المتصفح أبدًا. المفتاح لا يغادر السيرفر.
 *
 * لماذا Adapter منفصل؟
 *   حتى لا يرتبط منطق التطبيق باسم مزود واحد. لو أردنا التبديل من
 *   Anthropic إلى OpenAI (أو العكس)، نغيّر هذا الملف فقط.
 *
 * المزود يُختار عبر متغير البيئة LLM_PROVIDER:
 *   - "anthropic"  (افتراضي)
 *   - "openai"
 * ========================================================================= */

/* ─── إعدادات المزودين ─── */

const PROVIDERS = {
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-sonnet-4-6',
    apiKeyEnv: 'ANTHROPIC_API_KEY',

    headers(apiKey) {
      return {
        'content-type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01'
      };
    },

    body(systemPrompt, messages, model) {
      return {
        model:      model,
        max_tokens: 1200,
        system:     systemPrompt,
        messages:   messages.map(m => ({
          role:    m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        }))
      };
    },

    extractText(data) {
      if (!data || !Array.isArray(data.content)) return '';
      return data.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n')
        .trim();
    }
  },

  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    apiKeyEnv: 'OPENAI_API_KEY',

    headers(apiKey) {
      return {
        'content-type':  'application/json',
        'authorization': `Bearer ${apiKey}`
      };
    },

    body(systemPrompt, messages, model) {
      return {
        model:      model,
        max_tokens: 1200,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({
            role:    m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content
          }))
        ]
      };
    },

    extractText(data) {
      return data?.choices?.[0]?.message?.content?.trim() || '';
    }
  }
};

/* ─── الواجهة الموحدة ─── */

/**
 * استدعاء نموذج اللغة.
 * @param {string} systemPrompt - تعليمات النظام
 * @param {Array}  messages     - [{role:'user'|'assistant', content:'...'}]
 * @returns {Promise<{ok:boolean, text?:string, error?:string, provider:string}>}
 */
async function callLLM(systemPrompt, messages) {
  const providerName = (process.env.LLM_PROVIDER || 'anthropic').toLowerCase();
  const provider = PROVIDERS[providerName];

  if (!provider) {
    return {
      ok: false,
      provider: providerName,
      error: `مزود غير معروف: ${providerName}. القيم المسموحة: anthropic أو openai.`
    };
  }

  const apiKey = process.env[provider.apiKeyEnv];
  if (!apiKey) {
    return {
      ok: false,
      provider: providerName,
      error: `متغير البيئة ${provider.apiKeyEnv} غير مضبوط.`,
      missingKey: true
    };
  }

  const model = process.env.LLM_MODEL || provider.defaultModel;

  try {
    /* مهلة زمنية — حتى لا تتجمد المنصة إن تأخر المزود */
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const res = await fetch(provider.url, {
      method:  'POST',
      headers: provider.headers(apiKey),
      body:    JSON.stringify(provider.body(systemPrompt, messages, model)),
      signal:  controller.signal
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        ok: false,
        provider: providerName,
        error: `المزود أرجع خطأ ${res.status}`,
        /* 🔒 لا نُسرّب تفاصيل قد تحتوي أجزاء من المفتاح */
        detail: errText.slice(0, 200)
      };
    }

    const data = await res.json();
    const text = provider.extractText(data);

    if (!text) {
      return { ok: false, provider: providerName, error: 'رد فارغ من المزود.' };
    }

    return { ok: true, provider: providerName, model, text };

  } catch (err) {
    const aborted = err.name === 'AbortError';
    return {
      ok: false,
      provider: providerName,
      error: aborted ? 'انتهت مهلة الاتصال بالمزود.' : 'تعذر الاتصال بالمزود.'
    };
  }
}

module.exports = { callLLM, PROVIDERS };
