module.exports = ({ db }) => {

    function boardName(n) {
        let idx = n.lastIndexOf("@");
        if (idx != -1) n = n.substring(0, idx);
        n = n.split(".");
        for (let i = 0; i < n.length; i++) {
            if (n[i].length > 1) {
                n[i] = n[i][0].toUpperCase() + n[i].substring(1);
            }
        }
        return n.join(" ");
    }

    return {
        async getChat(user_id, chat_id) {
            return await (await db.prepare(`
SELECT messages.msg_id, datetime(messages.creation,'localtime') AS "creation", messages.user, messages.message, messages.file, boards.reference AS 'chat', IFNULL(readcounts.count, 0) AS 'readcount'
FROM messages INNER JOIN boards ON messages.board_id=boards.board_id
LEFT JOIN readcounts ON boards.board_id=readcounts.board_id AND readcounts.user=?
WHERE boards.reference=?
ORDER BY messages.creation ASC, messages.msg_id ASC
`)).all(user_id, chat_id)
        },
        async add(user_id, chat_id, msg, file) {
            let board = await (await db.prepare(`SELECT * FROM boards WHERE reference=?`)).get(chat_id);
            if (board == null) {
                // create board chat on the fly to obtain its id
                let result = await (await db.prepare(`INSERT INTO boards(reference) VALUES (?)`)).run(chat_id);
                board = await (await db.prepare(`SELECT * FROM boards WHERE board_id=?`)).get(result.lastID);
            }
            let user = await (await db.prepare(`SELECT * FROM users WHERE user_id=?`)).get(user_id);
            let result;
            if (file) {
                result = await (await db.prepare(`
INSERT INTO messages(user,board_id,file,creation)
VALUES(?, ?,?,datetime())                        
`)).run(boardName(user.login), board.board_id, file);
            } else {
                result = await (await db.prepare(`
INSERT INTO messages(user,board_id,message,creation)
VALUES(?, ?,?,datetime())                        
`)).run(boardName(user.login), board.board_id, msg);
            }
            return await (await db.prepare(`
SELECT messages.msg_id, datetime(messages.creation,'localtime') AS "creation", messages.user, messages.message, messages.file, ? AS 'chat' FROM messages 
WHERE messages.msg_id=?
`)).get(chat_id, result.lastID);
        },
        async count(user_id, chat_id, count) {
            let board = await (await db.prepare(`SELECT * FROM boards WHERE reference=?`)).get(chat_id);
            if (board == null) return;
            let user = await (await db.prepare(`SELECT * FROM users WHERE user_id=?`)).get(user_id);
            let readcount = await (await db.prepare(`SELECT * FROM readcounts WHERE user=? AND board_id=?`)).get(boardName(user.login), board.board_id);
            if (readcount == null) {
                return await (await db.prepare(`
INSERT INTO readcounts(user,board_id,count)
VALUES(?, ?,?)                        
                `)).run(boardName(user.login), board.board_id, count);
            } else {
                return await (await db.prepare(`
UPDATE readcounts SET count=? WHERE readcounts.readcount_id=?
                `)).run(count, readcount.readcount_id);
            }
        }
    }
}