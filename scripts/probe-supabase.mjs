const BASE = 'https://hmzwlraakrgtwgokbftp.supabase.co';
const KEY = 'sb_publishable_3FaqBb4MPgn9rKr_R4Uu2g_TWx-jM_r';

async function rpc(fn, args) {
  const r = await fetch(BASE + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: 'Bearer ' + KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args)
  });
  const txt = await r.text();
  return { status: r.status, body: txt.slice(0, 300) };
}

try {
  console.log('1) auth_card PET-001    ->', JSON.stringify(await rpc('auth_card', { p_code: 'PET-001' })));
  console.log('2) auth_card NOPE-999   ->', JSON.stringify(await rpc('auth_card', { p_code: 'NOPE-999' })));
  console.log('3) get_result 不存在     ->', JSON.stringify(await rpc('get_result', { p_id: 'zzzzzzzz' })));
} catch (e) {
  console.log('FETCH ERROR:', e.message, '|cause:', e.cause && e.cause.message);
}
