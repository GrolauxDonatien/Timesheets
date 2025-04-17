const bcrypt = require("bcrypt");

module.exports = ({ HTTPError, model, user, assert }) => {

    assert(() => {
        if (user.validated !== true) throw new HTTPError("Access Denied", 403)
    });

    return {
        async universes() {
            return await model.students.universes(user.user_id);
        },
        async slices(params) {
            return await model.students.slices(params.universe_id);
        },
        async mytasks(params) {
            return await model.students.mytasks(user.user_id, user.login, params.slice_id, params.universe_id);
        },
        async grouptasks(params) {
            return await model.students.grouptasks(user.user_id, user.login, params.universe_id);
        },
        async addEntry(params) {
            if (await model.students.canUpdateSlice(user.user_id, params.slice_id, params.universe_id)) {
                let slices = await model.students.slices(params.universe_id);
                let cand = null;
                for(let i=0; i<slices.length; i++) {
                    if (slices[i].slice_id==params.slice_id) {
                        cand=slices[i];
                        break;
                    }
                }
                let due_date=cand.end_date;
                if (due_date==0) {
                    due_date=new Date(cand.start_date);
                    due_date.setDate(due_date.getDate()+7);
                    due_date=due_date.toISOString().split('T')[0]
                }
                return await model.students.addEntry(user.user_id, params.slice_id, params.description, due_date);
            } else {
                throw new HTTPError("Cannot create new task", 403);
            }
        },
        async setEntry(params) {
            if (await model.students.canUpdateSlice(user.user_id, params.slice_id, params.universe_id)) {
                let slice = await model.slices.getByID(params.slice_id);
                if (slice.locked == 1) {
                    let entry=await model.students.getEntry(user.userid, params.timeentry_id);
                    if (entry!=null && entry.creation<=slice.start_date) {
                        return await model.students.setEntry(user.user_id, params.slice_id, params.timeentry_id, params.progress, params.length);
                    }
                } 
                return await model.students.setEntry(user.user_id, params.slice_id, params.timeentry_id, params.progress, params.length, params.description);
            } else {
                throw new HTTPError("Cannot update task", 403);
            }
        },
        async setEntryDueDate(params) {
            if (await model.students.canUpdateSlice(user.user_id, params.slice_id, params.universe_id)) {
                let slice = await model.slices.getByID(params.slice_id);
                if (slice.locked == 1) {
                    let entry=await model.students.getEntry(user.userid, params.timeentry_id);
                    if (entry!=null && entry.creation<=slice.start_date) {
                        return await model.students.setEntryDueDate(user.user_id, params.slice_id, params.timeentry_id, params.due_date);
                    }
                } 
                return await model.students.setEntryDueDate(user.user_id, params.slice_id, params.timeentry_id, params.due_date);
            } else {
                throw new HTTPError("Cannot update task", 403);
            }
        },
        async deleteEntry(params) {
            let entry = await model.students.getEntry(user.user_id, params.timeentry_id);
            if (entry != null // got an entry
                && params.slice_id == entry.slice_id // that's the right slice for this entry
                && await model.students.canUpdateSlice(user.user_id, entry.slice_id, params.universe_id)) { // the user is allowed to edit this slice
                let slice = await model.slices.getByID(params.slice_id);
                if (slice.locked == 0 || slice.start_date != entry.creation) {
                    return await model.students.deleteEntry(user.user_id, slice.slice_id, entry.timeentry_id);
                }
            }
            throw new HTTPError("Cannot delete task", 403);
        },
        async setGroupTask(params) {
            if (await model.students.canUpdateTask(user.user_id, params.task_id, params.universe_id)) {
                if ("description" in params) return await model.students.setTaskDescription(params.task_id, params.description);
                if ("start_date" in params) return await model.students.setTaskStart(params.task_id, params.start_date);
                if ("end_date" in params) return await model.students.setTaskEnd(params.task_id, params.end_date);
                if ("type_id" in params) return await model.students.setTaskKanban(params.task_id, params.type_id);
            }
            throw new HTTPError("Cannot change task", 403);
        },
        async deleteGroupTask(params) {
            if (await model.students.canUpdateTask(user.user_id, params.task_id, params.universe_id)) {
                return await model.students.deleteTask(params.task_id);
            }
            throw new HTTPError("Cannot delete task", 403);
        },
        async addGroupTask(params) {
            let group = await model.students.getGroup(user.user_id, params.universe_id);
            if (group != null) {
                return await model.students.createTask(group.group_id, params.description);
            }
            throw new HTTPError("Cannot create task", 403);
        },
        async addEntryToLastOpenSlice(params) {
            let slices = await model.students.slices(params.universe_id);
            let cand = null;
            for (let i = 0; i < slices.length; i++) {
                if (slices[i].end_date == 0) {
                    if (cand == null || cand.start_date < slices[i].start_date || (cand.start_date == slices[i].start_date && cand.slice_id < slices[i].slice_id)) cand = slices[i];
                }
            }
            if (cand == null) {
                throw new HTTPError("Nowhere to create task", 403);
            }
            if (await model.students.canUpdateSlice(user.user_id, cand.slice_id, params.universe_id)) {
                return await model.students.addEntry(user.user_id, cand.slice_id, params.description, params.end_date);
            } else {
                throw new HTTPError("Cannot create new task", 403);
            }
        },
        async othersTasks(params) {
            let group = await model.students.getGroup(user.user_id, params.universe_id);
            return await model.students.othersTasks(user.user_id, group.group_id, params.slice_id)
        }
    }
}