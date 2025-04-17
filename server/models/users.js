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

    let ret={
        async register(user) {
            const create = await db.prepare("INSERT INTO users(login,password, admin, superadmin, validated) VALUES (?,?,0,0,1)");
            const result = await create.run(user.login, user.password);
            return result.lastID;
        },
        async getByLogin(login) {
            return await (await db.prepare("SELECT * FROM users WHERE login=?")).get(login);
        },
        async getById(id) {
            return await (await db.prepare("SELECT * FROM users WHERE user_id=?")).get(id);
        },
        async list(search, uid, cond = null) {
            if (uid !== undefined) {
                if (cond == null) {
                    cond = "";
                } else {
                    cond = " AND "
                };
                cond += `(EXISTS (SELECT 1 FROM universes WHERE universes.creator_id=${uid} AND universes.universe_id=universesusers.universe_id) OR EXISTS (SELECT 1 FROM assistants WHERE assistants.universe_id=universesusers.universe_id AND assistants.user_id=${uid}))`;
            }
            if ("universe_id" in search) {
                return await (await db.prepare(`
SELECT DISTINCT users.user_id, users.login, users.admin, users.validated 
FROM users, universesusers 
WHERE users.user_id=universesusers.user_id AND universesusers.universe_id=?
${cond == null ? "" : "AND " + cond}
`)).all(search.universe_id)
            } else {
                return await (await db.prepare(`
SELECT DISTINCT users.user_id, users.login, users.admin, users.validated 
FROM users, universesusers 
WHERE users.user_id=universesusers.user_id
${cond == null ? "" : "AND " + cond}
ORDER BY users.login`)).all();
            }
        },
        async listu(search, uid) {
            let cond = undefined;
            if (uid !== undefined) {
                cond = `(universes.creator_id=${uid} OR EXISTS (SELECT 1 FROM assistants WHERE assistants.universe_id=universes.universe_id AND assistants.user_id=${uid}))`;
            }
            let all = await (await db.prepare(`
SELECT users.user_id, users.login, users.admin, users.validated, universes.universe_id, universes.name
FROM users LEFT JOIN universesusers ON users.user_id=universesusers.user_id
LEFT JOIN universes ON universes.universe_id=universesusers.universe_id
${cond === undefined ? "" : "AND " + cond}
ORDER BY users.login
`)).all()
            let ret = [];
            let cur;
            let prev = { user_id: null };
            for (let i = 0; i < all.length; i++) {
                let tuple = all[i];
                if (tuple.user_id != prev.user_id) {
                    prev = tuple;
                    cur = {
                        user_id: tuple.user_id,
                        login: tuple.login,
                        admin: tuple.admin,
                        validated: tuple.validated,
                        universes: []
                    }
                    ret.push(cur);
                }
                if (tuple.universe_id != null) {
                    cur.universes.push(tuple.universe_id);
                }
            }
            // filter out according to universe_id search
            if ("universe_id" in search) {
                let uid=parseInt(search.universe_id);
                if (uid==-1) {
                    for(let i=ret.length-1; i>=0; i--) {
                        if (ret[i].universes.length>0) {
                            ret.splice(i,1);
                        }
                    }
                } else {
                    for(let i=ret.length-1; i>=0; i--) {
                        if (ret[i].universes.indexOf(uid)==-1) {
                            ret.splice(i,1);
                        }
                    }
                }
            }
            return ret;
        },
        async getUserByLogin(login, uid) {
            let cond = undefined;
            if (uid !== undefined) {
                cond = `(universes.creator_id=${uid} OR EXISTS (SELECT 1 FROM assistants WHERE assistants.universe_id=universes.universe_id AND assistants.user_id=${uid}))`;
            }
            let all = await (await db.prepare(`
SELECT users.user_id, users.login, users.admin, users.validated, universes.universe_id, universes.name
FROM users LEFT JOIN universesusers ON users.user_id=universesusers.user_id
LEFT JOIN universes ON universes.universe_id=universesusers.universe_id
${cond === undefined ? "" : "AND " + cond}
WHERE users.login=?
`)).all(login)
            let ret = [];
            let cur;
            let prev = { user_id: null };
            for (let i = 0; i < all.length; i++) {
                let tuple = all[i];
                if (tuple.user_id != prev.user_id) {
                    prev = tuple;
                    cur = {
                        user_id: tuple.user_id,
                        login: tuple.login,
                        admin: tuple.admin,
                        validated: tuple.validated,
                        universes: []
                    }
                    ret.push(cur);
                }
                if (tuple.universe_id != null) {
                    cur.universes.push(tuple.universe_id);
                }
            }
            return ret.length>0?ret[0]:null;
        },
        async delete(id) {
            return await (await db.prepare("DELETE FROM users WHERE user_id=?")).run(id);
        },
        async wipe(id) {
            // do not wipe universes created by this user, instead just remove its owner
            await (await db.prepare("UPDATE universes SET creator_id=NULL where creator_id=?")).run(id);
            await (await db.prepare("DELETE FROM universesusers WHERE user_id=?")).run(id);
            await (await db.prepare("DELETE FROM timeentries WHERE user_id=?")).run(id);
            await (await db.prepare("DELETE FROM usersgroups WHERE user_id=?")).run(id);
            await (await db.prepare("DELETE FROM assistants WHERE user_id=?")).run(id);
            return await (await db.prepare("DELETE FROM users WHERE user_id=?")).run(id);
        },
        async updatePassword(id, password) {
            await (await db.prepare("UPDATE users SET password=? WHERE user_id=?")).run(password, id);
        },
        async updateAdmin(id, admin) {
            await (await db.prepare("UPDATE users SET admin=? WHERE user_id=?")).run(admin?1:0, id);
        },
        async setValidated(id, validated) {
            return await (await db.prepare("UPDATE users SET validated=? WHERE user_id=? AND admin=0")).run(validated, id);
        },
        async setUniverses(id, list, caid) {
            let o = {};
            for (let i = 0; i < list.length; i++) o[list[i]] = true;
            let all;
            if (caid === undefined) {
                all = await (await db.prepare(`SELECT * FROM universesusers WHERE user_id=?`)).all(id);
            } else {
                all = await (await db.prepare(`
SELECT universesusers.* 
FROM universesusers INNER JOIN universes ON universesusers.universe_id=universes.universe_id
WHERE universesusers.user_id=? AND (universes.creator_id=? OR EXISTS (SELECT 1 FROM assistants WHERE assistants.universe_id=universes.universe_id AND assistants.user_id=?))`)).all(id, caid, caid);
            }
            for (let i = 0; i < all.length; i++) {
                if (all[i].universe_id in o) {
                    delete o[all[i].universe_id];
                } else {
                    await (await db.prepare(`DELETE FROM universesusers WHERE universeuser_id=?`)).run(all[i].universeuser_id);
                }
            }
            for (let k in o) {
                await (await db.prepare(`INSERT INTO universesusers(user_id, universe_id) VALUES (?,?) `)).run(id, k);
            }
            return true;
        },
        async getAllUniverses(id) {
            return await (await db.prepare(`
SELECT universes.*
FROM universes INNER JOIN universesusers ON universes.universe_id=universesusers.universe_id
AND universesusers.user_id=?
            `)).all(id);
        },
        async listUsersNotInGroups(uid) {
            return await (await db.prepare(`
SELECT users.* 
FROM users INNER JOIN universesusers ON users.user_id=universesusers.user_id
WHERE universesusers.universe_id=? AND users.validated=1
AND NOT EXISTS (
    SELECT * 
    FROM usersgroups INNER JOIN groups ON usersgroups.group_id=groups.group_id
    WHERE groups.universe_id=universesusers.universe_id AND usersgroups.user_id=users.user_id)
ORDER BY users.login ASC`)).all(uid);
        },
        async boards(uid, deleted=false, caid) {
            let user = ret.getById(uid);
            if (user == null) return [];
            let name = boardName(user.login);
            // 4 types of boards : timeentries, groups, deleted timeentries, deleted groups
/*            let cond="";
            if (caid!==undefined) {
                cond=` AND (NOT EXISTS (SELECT DISTINCT universes.name FROM universes INNER JOIN slices ON universes.universe_id=slices.universe_id AND timeentries.slice_id=slices.slice_id) 
OR (EXISTS SELECT 1 FROM universes 
    INNER JOIN slices ON universes.universe_id=slices.universe_id AND timeentries.slice_id=slices.slice_id 
    WHERE universes.creator_id=${caid} OR EXISTS (SELECT 1 FROM assistants WHERE assistants.universe_id=universes.universe_id AND assistants.user_id=${caid}))                
                )`;
                cond='AND (NOT EXISTS (SELECT DISTINCT universes.name FROM universes INNER JOIN slices ON universes.universe_id=slices.universe_id AND timeentries.slice_id=slices.slice_id))';
            }*/

//            OR (EXISTS SELECT 1 FROM universes INNER JOIN slices ON universes.universe_id=slices.universe_id AND timeentries.slice_id=slices.slice_id
//                LEFT JOIN assistants ON universes.universe_id=assistants.universe_id
//                WHERE universes.creator_id=${caid} OR assistants.user_id=${caid}))


            let query=`
SELECT 'Own task: ' || timeentries.description AS "description", COUNT(messages.msg_id) AS "messages", 
(SELECT DISTINCT universes.name FROM universes INNER JOIN slices ON universes.universe_id=slices.universe_id AND timeentries.slice_id=slices.slice_id) AS "universe",
(SELECT DISTINCT universes.universe_id FROM universes INNER JOIN slices ON universes.universe_id=slices.universe_id AND timeentries.slice_id=slices.slice_id) AS "universe_id",
boards.reference as "chat"
FROM timeentries 
LEFT JOIN boards ON 't' || timeentries.timeentry_id=boards.reference
LEFT JOIN messages ON messages.board_id=boards.board_id
WHERE timeentries.user_id=? ${
    caid==undefined?"":`
        AND (NOT EXISTS (SELECT DISTINCT universes.name FROM universes INNER JOIN slices ON universes.universe_id=slices.universe_id AND timeentries.slice_id=slices.slice_id)
        OR EXISTS (SELECT 1 FROM universes INNER JOIN slices ON universes.universe_id=slices.universe_id AND timeentries.slice_id=slices.slice_id
            LEFT JOIN assistants ON universes.universe_id=assistants.universe_id
            WHERE universes.creator_id=${caid} OR assistants.user_id=${caid}))
    `
}
GROUP BY timeentries.timeentry_id
HAVING COUNT(messages.msg_id)>0
UNION
SELECT 'Group task: ' || tasks.description AS "description", COUNT(messages.msg_id) AS "messages", 
(SELECT DISTINCT universes.name FROM universes INNER JOIN groups ON universes.universe_id=groups.universe_id AND tasks.group_id=groups.group_id) AS "universe",
(SELECT DISTINCT universes.universe_id FROM universes INNER JOIN groups ON universes.universe_id=groups.universe_id AND tasks.group_id=groups.group_id) AS "universe_id",
boards.reference as "chat"
FROM tasks
LEFT JOIN boards ON 'g' || tasks.task_id=boards.reference
LEFT JOIN messages ON messages.board_id=boards.board_id
WHERE EXISTS (SELECT 1 FROM usersgroups WHERE usersgroups.group_id=tasks.group_id AND usersgroups.user_id=?)  ${
    caid==undefined?"":`
        AND (NOT EXISTS (SELECT DISTINCT universes.name FROM universes INNER JOIN groups ON universes.universe_id=groups.universe_id AND tasks.group_id=groups.group_id)
        OR EXISTS (SELECT 1 FROM universes INNER JOIN groups ON universes.universe_id=groups.universe_id AND tasks.group_id=groups.group_id
            LEFT JOIN assistants ON universes.universe_id=assistants.universe_id
            WHERE universes.creator_id=${caid} OR assistants.user_id=${caid}))
    `
}
GROUP BY tasks.task_id
HAVING COUNT(messages.msg_id)>0`;
            if (deleted) {
                query+=`
UNION 
SELECT 'Deleted own task' AS "description", COUNT(messages.msg_id) as "messages", '' AS "universe", null AS "universe_id", boards.reference as "chat"
FROM boards LEFT JOIN messages ON messages.board_id=boards.board_id
WHERE boards.reference LIKE 't%'
AND EXISTS (SELECT 1 FROM messages WHERE messages.user=? AND messages.board_id=boards.board_id)
AND NOT EXISTS (SELECT 1 FROM timeentries WHERE 't' || timeentries.timeentry_id=boards.reference)
GROUP BY boards.board_id
HAVING COUNT(messages.msg_id)>0
UNION 
SELECT 'Deleted group task' AS "description", COUNT(messages.msg_id) as "messages", '' AS "universe", null AS "universe_id", boards.reference as "chat"
FROM boards LEFT JOIN messages ON messages.board_id=boards.board_id
WHERE boards.reference LIKE 'g%'
AND EXISTS (SELECT 1 FROM messages WHERE messages.user=? AND messages.board_id=boards.board_id)
AND NOT EXISTS (SELECT 1 FROM tasks WHERE 'g' || tasks.task_id=boards.reference) 
GROUP BY boards.board_id
HAVING COUNT(messages.msg_id)>0
                `
            }
            query+=`
ORDER BY chat ASC
            `
            if (deleted) {
                return await (await db.prepare(query)).all(uid, uid, name, name);
            } else {
                return await (await db.prepare(query)).all(uid, uid);
            }
        }
    }

    return ret;
}
