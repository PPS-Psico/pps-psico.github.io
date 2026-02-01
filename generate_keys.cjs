const webpush = require("web-push");
const keys = webpush.generateVAPIDKeys();
const fs = require("fs");
fs.writeFileSync("vapid_keys_gen.json", JSON.stringify(keys, null, 2));
console.log("Keys generated");
