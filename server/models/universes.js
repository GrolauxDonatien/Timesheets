module.exports = ({ db }) => {

    return {
        async list(uid) {
            let all;
            if (uid===undefined) {
                all=await (await db.prepare(`
SELECT universes.*, users.login AS creator, assistants.user_id AS assistant_id, u2.login AS assistant_login
FROM universes LEFT OUTER JOIN users ON universes.creator_id=users.user_id
LEFT OUTER JOIN assistants ON universes.universe_id=assistants.universe_id
LEFT OUTER JOIN users u2 ON assistants.user_id=u2.user_id
ORDER BY universes.registrable DESC, universes.active DESC, universes.name ASC`)).all();
            } else {
                all=await (await db.prepare(`
SELECT universes.*, users.login AS creator, assistants.user_id AS assistant_id, u2.login AS assistant_login
FROM universes LEFT OUTER JOIN users ON universes.creator_id=users.user_id 
LEFT OUTER JOIN assistants ON universes.universe_id=assistants.universe_id
LEFT OUTER JOIN users u2 ON assistants.user_id=u2.user_id
WHERE universes.creator_id=? OR EXISTS (SELECT 1 FROM assistants WHERE assistants.universe_id=universes.universe_id AND assistants.user_id=?)
ORDER BY universes.registrable DESC, universes.active DESC, universes.name ASC`)).all(uid, uid);                
            }
            let ret=[];
            let cur;
            let prev={universe_id:null};
            for(let i=0; i<all.length; i++) {
                let tuple=all[i];
                if (tuple.universe_id!=prev.universe_id) {
                    prev=tuple;
                    cur={
                        universe_id:tuple.universe_id,
                        name:tuple.name,
                        creator:tuple.creator,
                        registrable:tuple.registrable,
                        active:tuple.active,
                        lockable:tuple.lockable,
                        creator_id:tuple.creator_id,
                        assistants:[]
                    }
                    ret.push(cur);
                }
                if (tuple.assistant_id!=null) {
                    cur.assistants.push({
                        user_id:tuple.assistant_id,
                        login:tuple.assistant_login
                    });
                }
            }
            return ret;

        },
        async set(values) {
            return await (await db.prepare("UPDATE universes SET name=?, registrable=?, active=?, lockable=? WHERE universe_id=?")).run(values.name, values.registrable, values.active, values.lockable, values.universe_id);
        },
        async delete(id) {
            return await (await db.prepare("DELETE FROM universes WHERE universe_id=?")).run(id);
        },
        async wipe(id) {
            // delete everything related to this universe
            await (await db.prepare(`DELETE FROM tasks WHERE group_id IN (SELECT group_id FROM groups WHERE universe_id=?)`)).run(id);
            await (await db.prepare(`DELETE FROM usersgroups WHERE group_id IN (SELECT group_id FROM groups WHERE universe_id=?)`)).run(id);
            await (await db.prepare(`DELETE FROM groups WHERE universe_id=?`)).run(id);
            await (await db.prepare(`DELETE FROM timeentries WHERE slice_id IN (SELECT slice_id FROM slices WHERE universe_id=?)`)).run(id);
            await (await db.prepare(`DELETE FROM slices WHERE universe_id=?`)).run(id);
            await (await db.prepare(`DELETE FROM universesusers WHERE universe_id=?`)).run(id);
            await (await db.prepare(`DELETE FROM assistants WHERE universe_id=?`)).run(id);
            return await (await db.prepare("DELETE FROM universes WHERE universe_id=?")).run(id);
        },
        async create(values) {
            const create=await db.prepare("INSERT INTO universes (name, registrable, active, creator_id) VALUES (?,?,?,?)");
            let result=await create.run(values.name,values.registrable,values.active,values.user_id);
            return await (await db.prepare("SELECT universes.*, users.login AS creator FROM universes LEFT OUTER JOIN users ON universes.creator_id=users.user_id WHERE universe_id=?")).get(result.lastID);
        },
        async getStats(universeid) {
            return await (await db.prepare(`
SELECT groups.group_id, groups.name, slices.slice_id, SUM(timeentries.length) AS length, COUNT(DISTINCT timeentry_id) AS countte, COUNT(DISTINCT usersgroups.user_id) AS userscount
FROM groups INNER JOIN usersgroups ON groups.group_id=usersgroups.group_id
INNER JOIN users ON usersgroups.user_id=users.user_id
INNER JOIN timeentries ON timeentries.user_id=users.user_id
INNER JOIN slices ON timeentries.slice_id=slices.slice_id
WHERE groups.universe_id=?
AND slices.universe_id=groups.universe_id
GROUP BY groups.group_id, slices.slice_id
            `)).all(universeid);
        },
        async getRegistrable() {
            return await (await db.prepare("SELECT universes.* FROM universes WHERE universes.registrable=1 and universes.active=1 ORDER BY universes.name ASC")).all();
        },
        async getByID(uid) {
            return await (await db.prepare("SELECT * FROM universes WHERE universe_id=?")).get(uid);
        },
        async getByIDWithAccessRight(uid, caid) {
            return await (await db.prepare("SELECT * FROM universes WHERE universe_id=? AND (creator_id=? OR EXISTS (SELECT 1 FROM assistants WHERE assistants.universe_id=universes.universe_id AND assistants.user_id=?))")).get(uid, caid, caid);
        },
        async getByTimeEntry(tid) {
            return await (await db.prepare(`
SELECT * 
FROM universes INNER JOIN slices ON universes.universe_id=slices.universe_id
INNER JOIN timeentries ON timeentries.slice_id=slices.slice_id
WHERE timeentries.timeentry_id=?`)).get(tid);
        },
        async getByTimeEntryWithAccessRight(tid, caid) {
            return await (await db.prepare(`
SELECT * 
FROM universes INNER JOIN slices ON universes.universe_id=slices.universe_id
INNER JOIN timeentries ON timeentries.slice_id=slices.slice_id
WHERE timeentries.timeentry_id=? 
AND (universes.creator_id=? OR EXISTS (SELECT 1 FROM assistants WHERE assistants.universe_id=universes.universe_id AND assistants.user_id=?))
`)).get(tid, caid, caid);
        },
        async listPossibleAssistants(uid) {
            return await (await db.prepare(`
SELECT  users.user_id, users.login 
FROM users
WHERE users.admin=1
AND (users.user_id NOT IN (SELECT universes.creator_id FROM universes WHERE universes.universe_id=?))
AND (users.user_id NOT IN (SELECT user_id FROM assistants WHERE assistants.universe_id=?))
            `)).all(uid,uid);
        },
        async setAssistants(uid, list) {
            let o={};
            for(let i=0; i<list.length; i++) o[list[i]]=true;
            let all=await (await db.prepare(`SELECT * FROM assistants WHERE universe_id=?`)).all(uid)
            for(let i=0; i<all.length; i++) {
                if (all[i].user_id in o) {
                    delete o[all[i].user_id];
                } else {
                    await (await db.prepare(`DELETE FROM assistants WHERE assistant_id=?`)).run(all[i].assistant_id);
                }
            }
            for(let k in o) {
                await (await db.prepare(`INSERT INTO assistants(universe_id, user_id) VALUES (?,?) `)).run(uid,parseInt(k));
            }
            return true;
        },
        async removeAssistant(uid,aid) {
            await (await db.prepare(`DELETE FROM assistants WHERE universe_id=? AND user_id=?`)).run(uid, aid);
        },
        async getExportData(uid) {
            return await (await db.prepare(`SELECT users.login, timeentries.description, timeentries.progress, timeentries.length, timeentries.creation, slices.name, groups.name as 'group'
            FROM users 
            INNER JOIN timeentries ON  timeentries.user_id = users.user_id 
            INNER JOIN slices ON  timeentries.slice_id = slices.slice_id 
            INNER JOIN usersgroups ON usersgroups.user_id=users.user_id 
            INNER JOIN groups ON usersgroups.group_id=groups.group_id 
            WHERE slices.universe_id = ? and groups.universe_id=slices.universe_id
            order by slices.name ASC, groups.name ASC`)).all(uid);
        }
    }

}