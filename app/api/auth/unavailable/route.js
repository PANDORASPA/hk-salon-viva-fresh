// Native form fallback only. Never read, authenticate, persist or log its body.
// JavaScript-enabled forms prevent this POST and use the normal Auth client.
export function POST() {
  return new Response('<!doctype html><html lang="zh-HK"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>登入未完成</title><h1>登入未完成</h1><p>請啟用 JavaScript 並重新載入登入頁面，再試一次。未有處理或儲存你提交的登入資料。</p><p><a href="/signin">返回登入</a></p></html>', {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    },
  })
}
