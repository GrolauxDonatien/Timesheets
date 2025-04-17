module.exports = ({ db }) => {

    return {
        async list(uid) {
            let all=await (await db.prepare(`
SELECT users.*, groups.* 
FROM groups LEFT JOIN usersgroups ON groups.group_id=usersgroups.group_id
LEFT JOIN users ON users.user_id=usersgroups.user_id
WHERE groups.universe_id=?
            `)).all(uid);
            let ret=[];
            let cur;
            let prev={group_id:null};
            for(let i=0; i<all.length; i++) {
                let tuple=all[i];
                if (tuple.group_id!=prev.group_id) {
                    prev=tuple;
                    cur={
                        group_id:tuple.group_id,
                        name:tuple.name,
                        universe_id:tuple.universe_id,
                        users:[]
                    }
                    ret.push(cur);
                }
                if (tuple.user_id!=null) {
                    cur.users.push({
                        user_id:tuple.user_id,
                        login:tuple.login
                    });
                }
            }
            return ret;
        },
        async setName(gid,name) {
            return await (await db.prepare("UPDATE groups SET name=? WHERE group_id=?")).run(name,gid);
        },
        async getUniverse(gid) {
            return await (await db.prepare("SELECT * FROM universes INNER JOIN groups ON universes.universe_id=groups.universe_id AND groups.group_id=?")).get(gid);
        },
        async getUniverseWithAccessRight(gid, caid) {
            return await (await db.prepare("SELECT * FROM universes INNER JOIN groups ON universes.universe_id=groups.universe_id AND groups.group_id=? WHERE universes.creator_id=? OR EXISTS (SELECT 1 FROM assistants WHERE assistants.universe_id=universes.universe_id AND assistants.user_id=?)")).get(gid, caid, caid);
        },
        async delete(id) {
            return await (await db.prepare("DELETE FROM groups WHERE group_id=?")).run(id);
        },
        async wipe(id) {
            await (await db.prepare("DELETE FROM tasks WHERE group_id=?")).run(id);
            await (await db.prepare("DELETE FROM usersgroups WHERE group_id=?")).run(id);
            return await (await db.prepare("DELETE FROM groups WHERE group_id=?")).run(id);
        },
        async add(name,uid) {
            return await (await db.prepare("INSERT INTO groups(name,universe_id) VALUES (?,?)")).run(name,uid);
        },
        async getByName(name,uid) {
            return await (await db.prepare("SELECT * FROM groups WHERE name=? AND universe_id=?")).get(name,uid);
        },
        async setUsers(id,list) {
            let o={};
            for(let i=0; i<list.length; i++) o[list[i]]=true;
            let all=await (await db.prepare(`SELECT * FROM usersgroups WHERE group_id=?`)).all(id)
            for(let i=0; i<all.length; i++) {
                if (all[i].user_id in o) {
                    delete o[all[i].user_id];
                } else {
                    await (await db.prepare(`DELETE FROM usersgroups WHERE usergroup_id=?`)).run(all[i].usergroup_id);
                }
            }
            for(let k in o) {
                await (await db.prepare(`INSERT INTO usersgroups(group_id, user_id) VALUES (?,?) `)).run(id,parseInt(k));
            }
            return true;
        },
        async getTaskById(task_id) {
            return await (await db.prepare(`SELECT * FROM tasks WHERE task_id=?`)).get(task_id);
        },
        async getTasksByUniverseId(uid) {
            return await (await db.prepare(`
SELECT tasks.description, tasks.start_date, tasks.end_date, kanbantypes.description AS 'status' 
FROM tasks 
INNER JOIN kanbantypes ON tasks.type_id=kanbantypes.type_id 
INNER JOIN groups ON tasks.group_id=groups.group_id 
WHERE groups.universe_id=? 
            `)).all(uid);
        },
        async listUsersInGroup(gid) {
            return await (await db.prepare(`SELECT users.login FROM users INNER JOIN usersgroups ON users.user_id=usersgroups.user_id WHERE usersgroups.group_id=?`)).all(gid);
        },
        async kanbanTypes() {
            return await (await db.prepare(`
SELECT * FROM kanbantypes ORDER BY type_id
`)).all();
        }
    }
}