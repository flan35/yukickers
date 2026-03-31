
async function test() {
  const users = ['yuki_0121'];
  for (const user of users) {
    console.log(`Checking v1 for ${user}...`);
    try {
      // Try v1 API
      const res = await fetch(`https://kick.com/api/v1/channels/${user}`);
      console.log(`v1 Status: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`v1 Data keys: ${Object.keys(data)}`);
        // Check for previous_livestreams or similar
      }
    } catch (e) {
      console.log(`v1 Error: ${e.message}`);
    }
  }
}
test();
