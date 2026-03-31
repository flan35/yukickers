
async function test() {
  const users = ['yuki_0121', 'ponchan_2525'];
  for (const user of users) {
    console.log(`Checking ${user}...`);
    try {
      // Native fetch in Node 18+
      const res = await fetch(`https://kick.com/api/v2/channels/${user}/videos`);
      if (res.ok) {
        const videos = await res.json();
        if (videos.length > 0) {
          const v = videos[0];
          console.log(`USER: ${user}`);
          console.log(`ID: ${v.id}`);
          console.log(`UUID: ${v.uuid}`);
          console.log(`URL: https://kick.com/video/${v.uuid}`);
        } else {
          console.log(`No videos for ${user}`);
        }
      } else {
        console.log(`Failed for ${user}: ${res.status}`);
      }
    } catch (e) {
      console.log(`Error for ${user}: ${e.message}`);
    }
  }
}
test();
