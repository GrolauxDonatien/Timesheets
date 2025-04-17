const bcrypt = require("bcrypt");

module.exports = ({ HTTPError, model, user, assert }) => {

    assert(() => {
        if (user.admin !== true || user.validated !== true) throw new HTTPError("Access Denied", 403)
    });

    async function accessControlUniverse(uid) {
        if (isNaN(uid)) throw new HTTPError("Invalid universe", 422);
        if (user.superadmin === false) { // work on own stuff
            let universe = await model.universes.getByIDWithAccessRight(uid, user.user_id);
            if (universe == null) {
                throw new HTTPError("Access Denied", 403)
            } else {
                return universe;
            }
        }
    }

    async function accessControlGroup(gid) {
        if (user.superadmin === false) { // work on own stuff
            let universe = await model.groups.getUniverseWithAccessRight(gid, user.user_id);
            if (universe == null) {
                throw new HTTPError("Access Denied", 403)
            } else {
                return universe;
            }
        }
    }

    return {
        async list(params) {
            await accessControlUniverse(params.universe_id);
            return await model.groups.list(params.universe_id);
        },
        async set(params) {
            await accessControlGroup(params.group_id, user.user_id);
            return await model.groups.setName(params.group_id, params.name);
        },
        async delete(params) {
            await accessControlGroup(params.group_id, user.user_id);
            return await model.groups.delete(params.group_id);
        },
        async wipe(params) {
            await accessControlGroup(params.group_id, user.user_id);
            return await model.groups.wipe(params.group_id);
        },
        async add(params) {
            let uid = parseInt(params.universe_id);
            if (isNaN(uid)) throw new HTTPError("Invalid universe", 422);
            await accessControlUniverse(uid);
            params.name = params.name.trim();
            if (params.name.length == 0) throw new HTTPError("Name too short (1+)", 422);
            let suffix = "";
            let c = 0;
            while (await model.groups.getByName(params.name + suffix, uid) != null) {
                c++;
                suffix = " " + c + "";
            }
            return await model.groups.add(params.name + suffix, uid);
        },
        async setUsers(params) {
            await accessControlGroup(params.group_id, user.user_id);
            return await model.groups.setUsers(params.group_id, params.users);
        },
        async listUsersNotInGroups(params) {
            await accessControlUniverse(params.universe_id);
            return await model.users.listUsersNotInGroups(params.universe_id);
        },
        async listUsersInGroup(params) {
            await accessControlUniverse(params.universe_id);
            return await model.groups.listUsersInGroup(params.group_id);
        },
        async userTasks(params) {
            await accessControlGroup(params.group_id, user.user_id);
            return await model.students.othersTasks(-1, params.group_id, params.slice_id)
        },
        async groupTasks(params) {
            await accessControlGroup(params.group_id, user.user_id);
            return await model.students.grouptasksByID(params.group_id)
        }
    }
}