const BASE = 'https://hmzwlraakrgtwgokbftp.supabase.co';
const KEY = 'sb_publishable_3FaqBb4MPgn9rKr_R4Uu2g_TWx-jM_r';

async function rpc(fn, args) {
  const r = await fetch(BASE + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  return { status: r.status, body: (await r.text()).slice(0, 300) };
}

console.log('1) 卡密剩余次数（测过一次后应为 2）:');
console.log('   ', JSON.stringify(await rpc('auth_card', { p_code: 'PET-001' })));
console.log('2) 读取刚生成的分享结果 otpSksF7:');
const got = await rpc('get_result', { p_id: 'otpSksF7' });
console.log('   ', JSON.stringify(got).slice(0, 320));
console.log('3) 随便试个不存在的短链:');
console.log('   ', JSON.stringify(await rpc('get_result', { p_id: 'aaaaaaaa' })));
