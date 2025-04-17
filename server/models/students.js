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
        async universes(uid) {
            // list universes for which the user is in a group
            // and the universe is active
            // and the user is validated
            return await (await db.prepare(`
SELECT universes.*, MIN(groups.name) AS 'group'
FROM universes INNER JOIN universesusers ON universes.universe_id=universesusers.universe_id
INNER JOIN users ON users.user_id=universesusers.user_id
INNER JOIN usersgroups ON users.user_id=usersgroups.user_id
INNER JOIN groups ON groups.group_id=usersgroups.group_id AND groups.universe_id=universes.universe_id
WHERE users.user_id=? AND users.validated=1 AND universes.active=1
GROUP BY universes.universe_id
            `)).all(uid);
        },
        async slices(uid) {
            return await (await db.prepare(`
SELECT slices.*, start_date<date() AND universes.lockable=1 AS locked 
FROM slices INNER JOIN universes ON slices.universe_id=universes.universe_id
WHERE slices.universe_id=? AND universes.active=1
ORDER BY slices.start_date DESC, slices.slice_id DESC
            `)).all(uid);
        },
        async mytasks(userid, login, sliceid, universeid) {
            return await (await db.prepare(`
SELECT timeentries.*, COUNT(messages.msg_id) AS "messages",
IFNULL((SELECT count FROM readcounts WHERE user=? AND readcounts.board_id=boards.board_id),0) AS "readcount"
FROM timeentries INNER JOIN slices ON timeentries.slice_id=slices.slice_id
INNER JOIN universes ON slices.universe_id=universes.universe_id
LEFT JOIN boards ON 't' || timeentries.timeentry_id=boards.reference
LEFT JOIN messages ON messages.board_id=boards.board_id
WHERE timeentries.slice_id=?
AND universes.universe_id=?
AND timeentries.user_id=?
AND universes.active=1
GROUP BY timeentries.timeentry_id
ORDER BY timeentries.creation DESC, timeentries.timeentry_id DESC
            `)).all(boardName(login), sliceid, universeid, userid)
        },
        async grouptasks(userid, login, universeid) {
            return await (await db.prepare(`
SELECT tasks.*, COUNT(messages.msg_id) AS "messages",
IFNULL((SELECT count FROM readcounts WHERE user=? AND readcounts.board_id=boards.board_id),0) AS "readcount"
FROM tasks LEFT JOIN boards ON 'g' || tasks.task_id=boards.reference
LEFT JOIN messages ON messages.board_id=boards.board_id
WHERE tasks.group_id=(
    SELECT MIN(groups.group_id)
    FROM groups INNER JOIN usersgroups ON groups.group_id=usersgroups.group_id
    INNER JOIN universes ON groups.universe_id=universes.universe_id
    AND universes.active=1
    AND usersgroups.user_id=?
    AND groups.universe_id=?    
) 
GROUP BY tasks.task_id
ORDER BY tasks.task_id
            `)).all(boardName(login), userid, universeid)
        },
        async othersTasks(userid, groupid, sliceid) {
            return await (await db.prepare(`
SELECT timeentries.*, users.login, COUNT(messages.msg_id) AS "messages"
FROM timeentries INNER JOIN users on timeentries.user_id=users.user_id
INNER JOIN usersgroups ON users.user_id=usersgroups.user_id
LEFT JOIN boards ON 't' || timeentries.timeentry_id=boards.reference
LEFT JOIN messages ON messages.board_id=boards.board_id
WHERE timeentries.slice_id=?
AND users.user_id<>?
AND usersgroups.group_id=?
GROUP BY timeentries.timeentry_id
ORDER BY users.login, timeentries.creation DESC, timeentries.timeentry_id DESC
            `)).all(sliceid, userid, groupid);
        },
        async grouptasksByID(groupid) {
            return await (await db.prepare(`
SELECT tasks.*, COUNT(messages.msg_id) AS "messages"
FROM tasks LEFT JOIN boards ON 'g' || tasks.task_id=boards.reference
LEFT JOIN messages ON messages.board_id=boards.board_id
WHERE tasks.group_id=?
GROUP BY tasks.task_id
ORDER BY tasks.description
            `)).all(groupid)
        },
        async canUpdateSlice(userid, sliceid, universeid) {
            return await (await db.prepare(`
    SELECT users.user_id
    FROM users
    WHERE users.user_id=?
    AND users.validated=1
    AND EXISTS (
        SELECT universes.universe_id
        FROM universesusers INNER JOIN universes
        WHERE universesusers.universe_id=universes.universe_id
        AND universes.active=1
        AND universes.universe_id=?
    ) AND EXISTS (
        SELECT slices.slice_id
        FROM slices
        WHERE slices.universe_id=?
        AND end_date=0
        AND slices.slice_id=?
    )
                `)).get(userid, universeid, universeid, sliceid) != null;
        },
        async addEntry(userid, sliceid, description) {
            return await (await db.prepare(`
INSERT INTO timeentries(user_id, slice_id, description, progress, length, creation)
VALUES (?, ?,?,0,0,date())
            `)).run(userid, sliceid, description);
        },
        async setEntry(userid, sliceid, entryid, progress, length, description) {
            if (description === undefined) {
                return await (await db.prepare(`
UPDATE timeentries 
SET progress=?, length=?
WHERE timeentry_id=? AND user_id=? AND slice_id=?
                            `)).run(progress, length, entryid, userid, sliceid);
            } else {
                return await (await db.prepare(`
UPDATE timeentries 
SET description=?, progress=?, length=?
WHERE timeentry_id=? AND user_id=? AND slice_id=?
                            `)).run(description, progress, length, entryid, userid, sliceid);
            }
        },
        async setEntryDueDate(userid, sliceid, entryid, due_date) {
            return await (await db.prepare(`
UPDATE timeentries 
SET due_date=?
WHERE timeentry_id=? AND user_id=? AND slice_id=?`)).run(due_date, entryid, userid, sliceid);
        },
        async deleteEntry(userid, sliceid, timeid) {
            return await (await db.prepare(`
DELETE FROM timeentries
WHERE user_id=? AND slice_id=? AND timeentry_id=?
            `)).run(userid, sliceid, timeid);
        },
        async getEntry(userid, timeid) {
            return await (await db.prepare(`
SELECT * FROM timeentries
WHERE user_id=? AND timeentry_id=?
            `)).get(userid, timeid);
        },
        async getEntryInSameGroup(userid, timeid) {
            return await (await db.prepare(`
SELECT timeentries.* 
FROM timeentries INNER JOIN slices ON timeentries.slice_id=slices.slice_id
WHERE timeentry_id=? AND EXISTS (
    SELECT 1 
    FROM groups INNER JOIN usersgroups ug1 ON groups.group_id=ug1.group_id
    INNER JOIN usersgroups ug2 ON groups.group_id=ug2.group_id
    WHERE groups.universe_id=slices.universe_id
    AND ug1.user_id=timeentries.user_id
    AND ug2.user_id=?
)
            `)).get(timeid, userid);
        },
        async canUpdateTask(user_id, task_id, universe_id) {
            return await (await db.prepare(`
SELECT task_id
FROM tasks
WHERE tasks.task_id=?
AND tasks.group_id=(
    SELECT MIN(groups.group_id)
    FROM groups INNER JOIN usersgroups ON groups.group_id=usersgroups.group_id
    INNER JOIN universes ON groups.universe_id=universes.universe_id
    AND universes.active=1
    AND usersgroups.user_id=?
    AND groups.universe_id=?      
)
            `)).get(task_id, user_id, universe_id) != null;
        },
        async setTaskDescription(task_id, description) {
            return await (await db.prepare(`
UPDATE tasks SET description=? WHERE task_id=?
            `)).run(description, task_id);
        },
        async setTaskStart(task_id, start) {
            return await (await db.prepare(`
UPDATE tasks SET start_date=? WHERE task_id=?
            `)).run(start, task_id);
        },
        async setTaskEnd(task_id, end) {
            return await (await db.prepare(`
UPDATE tasks SET end_date=? WHERE task_id=?
            `)).run(end, task_id);
        },
        async setTaskKanban(task_id, type) {
            return await (await db.prepare(`
UPDATE tasks SET type_id=? WHERE task_id=?
            `)).run(type, task_id);
        },
        async deleteTask(task_id) {
            return await (await db.prepare(`
DELETE FROM tasks WHERE task_id=?
            `)).run(task_id);
        },
        async getGroup(user_id, universe_id) {
            return await (await db.prepare(`
SELECT MIN(groups.group_id) AS group_id
FROM groups INNER JOIN usersgroups ON groups.group_id=usersgroups.group_id
INNER JOIN universes ON groups.universe_id=universes.universe_id
AND universes.active=1
AND usersgroups.user_id=?
AND groups.universe_id=?      
            `)).get(user_id, universe_id);
        },
        async createTask(group_id, description) {
            await (await db.prepare(`
INSERT INTO tasks(description, group_id) VALUES (?,?)
            `)).run(description, group_id);
        },
        async getGroupStats(groupid) {
            return await (await db.prepare(`
SELECT users.login, slices.slice_id, SUM(timeentries.length) AS length, COUNT(DISTINCT timeentry_id) AS countte 
FROM groups INNER JOIN usersgroups ON groups.group_id=usersgroups.group_id
INNER JOIN users ON usersgroups.user_id=users.user_id
INNER JOIN timeentries ON timeentries.user_id=users.user_id
INNER JOIN slices ON timeentries.slice_id=slices.slice_id
WHERE groups.group_id=?
AND slices.universe_id=groups.universe_id
GROUP BY users.user_id, slices.slice_id
            `)).all(groupid);
        }
    }
}
