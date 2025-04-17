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

    async function accessControlSlice(sid) {
        if (user.superadmin === false) { // work on own stuff
            let universe = await model.slices.getUniverseWithAccessRight(sid, user.user_id);
            if (universe == null) {
                throw new HTTPError("Access Denied", 403)
            } else {
                return universe;
            }
        }

    }

    return {
        async list(params) {
            let uid = parseInt(params.universe_id);
            await accessControlUniverse(uid);
            return await model.slices.list(uid);
        },
        async set(params) {
            await accessControlSlice(params.slice_id);
            return await model.slices.setName(params.slice_id, params.name);
        },
        async delete(params) {
            await accessControlSlice(params.slice_id);
            return await model.slices.delete(params.slice_id);
        },
        async reset(params) {
            await accessControlSlice(params.slice_id);
            await model.slices.reset(params.slice_id);
            return await model.slices.getByID(params.slice_id);
        },
        async wipe(params) {
            await accessControlSlice(params.slice_id);
            return await model.slices.wipe(params.slice_id);
        },
        async add(params) {
            let uid = parseInt(params.universe_id);
            if (isNaN(uid)) throw new HTTPError("Invalid universe", 422);
            params.name = params.name.trim();
            if (params.name.length == 0) throw new HTTPError("Name too short (1+)", 422);
            if (await model.slices.getByName(params.name, uid) != null) throw new HTTPError("Slice already exists", 422);
            await accessControlUniverse(uid);
            return await model.slices.add(params.name, uid);
        },
        async close(params) {
            await accessControlSlice(params.slice_id);
            await model.slices.setEndDate(params.slice_id);
            return await model.slices.getByID(params.slice_id);
        },
        async open(params) {
            await accessControlSlice(params.slice_id);
            await model.slices.clearEndDate(params.slice_id);
            return await model.slices.getByID(params.slice_id);
        }
    }
}