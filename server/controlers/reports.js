const bcrypt = require("bcrypt");

module.exports = ({ HTTPError, model, user, assert }) => {

    assert(() => {
        if (user.validated !== true) throw new HTTPError("Access Denied", 403)
    });

    return {
        async mytimes(params) {
            let group = await model.students.getGroup(user.user_id, params.universe_id);
            if (group == null) throw new HTTPError("You do not belong to a group");
            let slices = await model.slices.list(params.universe_id);

            let sliceNames = {};
            for (let i = 0; i < slices.length; i++) sliceNames[slices[i].slice_id] = slices[i];

            let aggregates = await model.students.getGroupStats(group.group_id);

            return {
                slices: sliceNames,
                data: aggregates
            }
        },
        async globalReport(params) {
            if (user.admin !== true) throw new HTTPError("Access Denied", 403)
            let slices = await model.slices.list(params.universe_id);

            let sliceNames = {};
            for (let i = 0; i < slices.length; i++) sliceNames[slices[i].slice_id] = slices[i];

            let aggregates = await model.universes.getStats(params.universe_id);

            return {
                slices: sliceNames,
                data: aggregates
            }
        },
        async groupReport(params) {
            if (user.admin !== true) throw new HTTPError("Access Denied", 403)
            let slices = await model.slices.list(params.universe_id);

            let sliceNames = {};
            for (let i = 0; i < slices.length; i++) sliceNames[slices[i].slice_id] = slices[i];

            let aggregates = await model.students.getGroupStats(params.group_id);

            return {
                slices: sliceNames,
                data: aggregates
            }
        }
    }
}