module.exports = ({ db }) => {

    return {
        async list(uid) {
            return await (await db.prepare(`
SELECT slices.*, start_date<date() AND universes.lockable=1 AS locked, universes.lockable 
FROM slices INNER JOIN universes ON slices.universe_id=universes.universe_id
WHERE universes.universe_id=?
ORDER BY start_date DESC, slice_id DESC
            `)).all(uid);
        },
        async setName(sid,name) {
            return await (await db.prepare("UPDATE slices SET name=? WHERE slice_id=?")).run(name,sid);
        },
        async delete(id) {
            return await (await db.prepare("DELETE FROM slices WHERE slice_id=?")).run(id);
        },
        async wipe(id) {
            await (await db.prepare("DELETE FROM timeentries WHERE slice_id=?")).run(id);
            return await (await db.prepare("DELETE FROM slices WHERE slice_id=?")).run(id);
        },
        async reset(id) {
            return await (await db.prepare("UPDATE slices SET start_date=date() where slice_id=?")).run(id);
        },
        async add(name,uid) {
            return await (await db.prepare("INSERT INTO slices(name,universe_id, start_date) VALUES (?,?, date())")).run(name,uid);
        },
        async getByName(name,uid) {
            return await (await db.prepare("SELECT * FROM slices WHERE name=? AND universe_id=?")).get(name,uid);
        },
        async setEndDate(sid) {
            return await (await db.prepare("UPDATE slices SET end_date=date() where slice_id=?")).run(sid);
        },
        async clearEndDate(sid) {
            return await (await db.prepare("UPDATE slices SET end_date=0 where slice_id=?")).run(sid);
        },
        async getByID(sid) {
            return await (await db.prepare(`SELECT slices.*, start_date<date() AS locked FROM slices WHERE slice_id=?`)).get(sid);
        },
        async getUniverse(gid) {
            return await (await db.prepare("SELECT * FROM universes INNER JOIN slices ON universes.universe_id=slices.universe_id AND slices.slice_id=?")).get(gid);
        },
        async getUniverseWithAccessRight(gid, caid) {
            return await (await db.prepare("SELECT * FROM universes INNER JOIN slices ON universes.universe_id=slices.universe_id AND slices.slice_id=? AND (universes.creator_id=? OR EXISTS (SELECT 1 FROM assistants WHERE assistants.universe_id=universes.universe_id AND assistants.user_id=?))")).get(gid,caid, caid);
        }
    }
}