const myArgs = process.argv.slice(2);
const config=require("./server/config.js");
const bcrypt = require("bcrypt");
const AsyncDatabase = require("promised-sqlite3").AsyncDatabase;

let db;

let email=(myArgs[0]||"").trim();
let pass=(myArgs[1]||"").trim();
let valid=false;
for(let i=0; i<config.emails.length; i++) {
    if (email.endsWith(config.emails[i])) {
        let short=email.substring(0,email.length-config.emails[i].length);
        if (short.indexOf(" ")!=-1) break; // cannot contain space
        if (short.length==0) break; // empty email
        let ishort=parseInt(short);
        if (!isNaN(ishort) && (ishort+""==short)) {
            break; // number only email
        }
        valid=true; // found something we can allow
        break;
    }
}

if (pass.length<8) valid=false;

if (!valid) {
    console.log(`${process.argv[0]} ${process.argv[1]} email password`);
    console.log(`email must end with: ${config.emails.join(",")}`);
    console.log(`email must contain a letter`);
    console.log(`password must be at least 8 characters long`);
    process.exit(1);
}

async function run() {
    db = await AsyncDatabase.open(config.dbfile);
    let hash = await bcrypt.hash(pass, 10);
    let superadmin=(await (await db.prepare("SELECT * FROM users WHERE admin=1")).get())==null?1:0
    await (await db.prepare("INSERT INTO users(login,password, admin, superadmin, validated) VALUES (?,?,?,?,?)")).run(email, hash, 1, superadmin, 1);
    console.log(`Admin ${email} was inserted successfully.`);
    if (superadmin==1) console.log(`As first admin, ${email} was promoted to superadmin.`);
    process.exit(0);    
}

run();
