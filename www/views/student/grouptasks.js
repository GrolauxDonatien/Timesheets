(() => {

    let kanbanTypes = null;

    function kanban(data) {
        let root = document.querySelector("#grouptasks .kanban");
        root.innerHTML = "<thead></thead><tbody></tbody>";
        let thead = root.querySelector("tbody");
        let tbody = root.querySelector("tbody");
        let tr = document.createElement("TR");
        thead.appendChild(tr);
        for (let i = 0; i < kanbanTypes.length; i++) {
            let th = document.createElement("TH");
            th.innerText = kanbanTypes[i].description;
            tr.appendChild(th);
        }
        let dnd = undefined;
        let hidedone = document.getElementById("hidedone").checked;
        for (let i = 0; i < data.length; i++) {
            if (data[i].type_id != null) {
                function allowDrop(event) {
                    if (dnd == i) {
                        event.preventDefault();
                        event.stopPropagation();
                        return false;
                    }
                }
                function drop(event) {
                    event.preventDefault();
                    event.stopPropagation();
                    let tds = event.target.parentElement.querySelectorAll("td");
                    for (let j = 0; j < kanbanTypes.length; j++) {
                        if (tds[j] == event.target) {
                            let row = data[dnd];
                            row.type_id = kanbanTypes[j].type_id;
                            dnd = undefined;
                            mispaf.ajax({
                                url: 'students/setGroupTask',
                                data: {
                                    universe_id: getUniverse(),
                                    task_id: row.task_id,
                                    type_id: row.type_id,
                                },
                                success() {
                                    table.refresh();
                                }
                            })
                            return;
                        }
                    }
                }
                let tr = document.createElement("TR");
                tbody.appendChild(tr);
                if (hidedone && data[i].type_id == kanbanTypes[kanbanTypes.length - 1].type_id) {
                    tr.style.display = "none";
                }
                for (let j = 0; j < kanbanTypes.length; j++) {
                    let td = document.createElement("TD");
                    td.addEventListener("dragover", allowDrop, true);
                    td.addEventListener("drop", drop, true);
                    if (kanbanTypes[j].type_id == data[i].type_id) {
                        let span = document.createElement("SPAN");
                        span.innerText = data[i].description;
                        span.setAttribute("draggable", "true");
                        td.appendChild(span);
                        span.addEventListener("dragstart", (event) => {
                            dnd = i;
                        }, true);
                        span.addEventListener("dragend", (event) => {
                            dnd = undefined;
                        }, true);
                    }
                    tr.appendChild(td);
                }
            }
        }
    }

    function renderDate(key) {
        return function (row) {
            let d = row[key];
            if (d == null) {
                return `<button data-type="${key}" class="btn btn-outline-secondary btn-sm">Set</button>`;
            } else {
                return `<input data-type="${key}" type="date" value="${new Date(d).toISOString().split('T')[0]}">`;
            }
        }
    }
    function refreshGantt() {
        if (document.getElementById("hidedone").checked) {
            let orig = table.get();
            let data = [];
            for (let i = 0; i < orig.length; i++) {
                if (orig[i].type_id != kanbanTypes[kanbanTypes.length - 1].type_id) {
                    data.push(orig[i]);
                }
            }
            ganttDiagram.refresh(data);
        } else {
            ganttDiagram.refresh(table.get());
        }
    }

    function manageDates() {
        function onChange(event, row) {
            let v = event.target.value;
            let d = (v == "" ? null : v);
            let key = event.target.getAttribute("data-type");
            row[key] = d;
            mispaf.ajax({
                url: 'students/setGroupTask',
                data: {
                    universe_id: getUniverse(),
                    task_id: row.task_id,
                    [key]: d,
                },
                success() {
                    refreshGantt();
                }
            })
        }
        return {
            async 'click:button'(event, row) {
                let input = document.createElement("INPUT");
                input.setAttribute("type", "date");
                input.setAttribute("data-type", event.target.getAttribute("data-type"));
                event.target.parentElement.replaceChild(input, event.target);
                input.addEventListener('change', (event) => { onChange(event, row) });
            },
            'change:input': onChange
        }
    }

    function manageStatus() {
        return {
            async 'change:select'(event, row) {
                row.type_id = parseInt(event.target.value);
                if (isNaN(row.type_id)) row.type_id = null;
                mispaf.ajax({
                    url: 'students/setGroupTask',
                    data: {
                        universe_id: getUniverse(),
                        task_id: row.task_id,
                        type_id: row.type_id,
                    },
                    success() {
                        kanban(table.get());
                    }
                })
            }
        }
    }

    function getUniverse() {
        return parseInt(document.getElementById("universe").value);
    }

    let selected = null;

    let tdiv = document.querySelector("#grouptasks .table-responsive");
    let mdiv = document.querySelector("#grouptasks .messages");

    let board = messageBoard({
        el: mdiv,
        urlcreate: "board/create",
        urlforget: "board/forget",
        urlget: "board/get",
        urlcount: "board/count",
        urlupload: "upload/board",
        ajax: websocket.ajax,
        broadcastListener: websocket.addBroadcastListener,
        canSend: true,
        extraParams() {
            return {
                universe_id: document.getElementById("universe").value
            }
        }
    });
    board.onmessage((chat, count) => {
        let display = tdiv.querySelector(`[data-chat="${chat}"]`);
        if (display != null) {
            if (count == 0) {
                display.querySelector(".total").innerHTML = "";
            } else {
                if (chat == selected) {
                    let unread = display.querySelector('.unread');
                    if (unread != null) unread.parentElement.removeChild(unread);
                    display.querySelector(".total").innerHTML = "(" + count + ")";
                } else {
                    display.querySelector(".total").innerHTML = "/" + count;
                }
            }
        }
    });

    let ganttDiagram = gantt.create(document.getElementById("gantt"));

    let table = smartTable({
        root: document.querySelector("#grouptasks table"),
        refresh(focus, text) {
            if (isNaN(getUniverse())) {
                table.set([]);
                tdiv.classList.add("none");
            } else {
                tdiv.classList.remove("none");
                mispaf.ajax({
                    url: "students/grouptasks",
                    type: 'POST',
                    data: {
                        universe_id: getUniverse()
                    },
                    success(response) {
                        table.set(response);
                        if (focus) {
                            let last = 0;
                            for (let i = 0; i < response.length; i++) {
                                if (response[i].task_id > last) last = response[i].task_id;
                            }
                            let rows = table.get();
                            for (let i = 0; i < rows.length; i++) {
                                if (rows[i].task_id == last) {
                                    table.focus(i, text);
                                    break;
                                }
                            }
                        }
                        refreshGantt();
                        kanban(table.get());
                        let sel = tdiv.querySelector(".selected");
                        if (sel != null) {
                            board.setBoard(sel.getAttribute("data-chat"));
                        } else {
                            board.setBoard(null);
                        }
                    }
                });
            }
        },
        columns: [
            {
                title: "Description",
                render(row) {
                    return mispaf.escape(row.description);
                },
                onedit(element, row, val) {
                    row.description = val;
                    mispaf.ajax({
                        url: 'students/setGroupTask',
                        data: {
                            universe_id: getUniverse(),
                            task_id: row.task_id,
                            description: row.description,
                        },
                        success: () => {
                            refreshGantt();
                        }
                    })
                },
                onevent: {
                    render(event, row) {
                        if (document.getElementById("hidedone").checked) {
                            if (kanbanTypes[kanbanTypes.length - 1].type_id == row.type_id) {
                                event.target.parentElement.style.display = 'none';
                            }
                        }
                    }
                }
            }, {
                title: "Messages",
                render(row) {
                    let count = '';
                    if (row.messages > 0) {
                        let remaining = row.messages - row.readcount;
                        if (remaining > 0) {
                            count = `<span class="unread">${remaining}</span><span class="total">/${row.messages}</span>`;
                        } else {
                            count = `<span class="total">(${row.messages})</span>`;
                        }
                    } else {
                        count = `<span class="total"></span>`;
                    }
                    return `<button class="btn btn-outline-secondary btn-sm messages ${(selected == ("g" + row.task_id)) ? 'selected' : ''}" data-chat="g${row.task_id}" >&#128172;${count}</button>`;
                },
                onevent: {
                    async 'click:button'(event, row) {
                        if (event.target.classList.contains("selected")) {
                            selected = null;
                            event.target.classList.remove("selected");
                            board.setBoard(null);
                        } else {
                            selected = "g" + row.task_id;
                            let old = tdiv.querySelector('.selected');
                            if (old) old.classList.remove("selected");
                            event.target.classList.add("selected");
                            board.setBoard(selected);
                        }
                    }
                }
            }, {
                title: "Dates",
                render(row) {
                    return '<div class="dates">' + renderDate("start_date")(row) + ' &#10132; ' + renderDate("end_date")(row) + "</div>";
                },
                onevent: manageDates()
            }, {
                title: "Status",
                render(row) {
                    let html = ["<select>"];
                    html.push(`<option ${row.type_id == null ? "selected" : ""}></option>`);
                    for (let i = 0; i < kanbanTypes.length; i++) {
                        html.push(`<option value="${kanbanTypes[i].type_id}" ${kanbanTypes[i].type_id == row.type_id ? "selected" : ""}>${kanbanTypes[i].description}</option>`);
                    }
                    html.push('</select>');
                    return html.join('');
                },
                onevent: manageStatus()
            }, {
                title: "Action",
                render(row) {
                    return `<button class="btn btn-outline-secondary btn-sm add">Add to my tasks</button> <button class="btn btn-outline-secondary btn-sm delete">Delete</button>`;
                },
                onevent: {
                    async 'click:button.add'(event, row) {
                        if (await modalConfirm("Do you want to add " + row.description + " to your list of tasks ?")) {
                            mispaf.ajax({
                                url: "students/addEntryToLastOpenSlice",
                                data: {
                                    universe_id: getUniverse(),
                                    description: row.description,
                                    end_date: row.end_date
                                },
                                success() {
                                    mispaf.page("mytasks");
                                    mispaf.ajaxDefault.success();
                                }
                            });
                        }
                    },
                    async 'click:button.delete'(event, row) {
                        if (await modalConfirm("Do you want to delete " + row.description + " ?")) {
                            mispaf.ajax({
                                url: "students/deleteGroupTask",
                                data: {
                                    task_id: row.task_id,
                                    universe_id: getUniverse(),
                                },
                                success() {
                                    table.removeRow(row);
                                    if (selected == "g" + row.task_id) {
                                        selected = null;
                                        board.setBoard(null);
                                    }
                                    mispaf.ajaxDefault.success();
                                    refreshGantt();
                                }
                            });
                        }
                    }
                }
            }
        ],
        onadd() {
            mispaf.ajax({
                url: "students/addGroupTask",
                data: {
                    universe_id: getUniverse(),
                    description: 'New Task'
                },
                success() {
                    table.refresh(true, 'New Task');
                    mispaf.ajaxDefault.success();
                }
            });
        }
    })

    let cont = null;

    function getKanbanTypes() {
        mispaf.ajax({
            url: "auth/kanbanTypes",
            success(response) {
                kanbanTypes = response;
                if (cont !== null) cont();
            },
            error() {
                // retry
                getKanbanTypes();
            }
        });
    }

    getKanbanTypes();

    document.getElementById('hidedone').addEventListener('change', () => {
        localStorage.setItem("hidedone", "" + document.getElementById('hidedone').checked);
        mispaf.page(mispaf.page());
    });

    mispaf.addPageListener('enter:grouptasks', () => {
        cont = () => {
            document.getElementById('hidedone').checked = (localStorage.getItem("hidedone") == "true");
            board.setMyself(boardName(mispaf.user.login));
            table.refresh();
            cont = null;
        }
        if (kanbanTypes !== null) cont();
    });
    document.getElementById('universe').addEventListener('change', () => {
        if (mispaf.page() == "grouptasks") table.refresh();
    });
})();