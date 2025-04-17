(() => {

    let slicesSelect = document.querySelector("#mytasks .sliceselect select");
    let slices = {};
    let slice = null;
    let tdiv = document.querySelector("#mytasks .table-responsive");
    let mdiv = document.querySelector("#mytasks .messages");

    let selected = null;
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
        extraParams(){
            return {
                universe_id:document.getElementById("universe").value
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

    function getUniverse() {
        return parseInt(document.getElementById("universe").value);
    }

    function getSlice() {
        return parseInt(slicesSelect.value);
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

    function manageDates() {
        function onChange(event, row) {
            let v = event.target.value;
            let d = (v == "" ? null : v);
            let key = event.target.getAttribute("data-type");
            row[key] = d;
            mispaf.ajax({
                url: 'students/setEntryDueDate',
                data: {
                    slice_id: getSlice(),
                    universe_id: getUniverse(),
                    timeentry_id: row.timeentry_id,
                    due_date:d
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

    let prog=progress({root:document.querySelector('#mytasks .progress')});

    let table = smartTable({
        root: document.querySelector('#mytasks table'),
        refresh(focus=false,text) {
            if (isNaN(getSlice())) {
                table.set([]);
                tdiv.classList.add("none");
            } else {
                tdiv.classList.remove("none");
                tdiv.querySelector('tfoot').style.display = (slice.end_date != 0) ? "none" : "table-footer-group";
                mispaf.ajax({
                    url: "students/mytasks",
                    type: 'POST',
                    data: {
                        universe_id: getUniverse(),
                        slice_id: slice.slice_id
                    },
                    success(response) {
                        table.set(response);
                        if (focus) {
                            let last=0;
                            for(let i=0; i<response.length; i++) {
                                if (response[i].timeentry_id>last) last=response[i].timeentry_id;
                            }
                            let rows=table.get();
                            for(let i=0; i<rows.length; i++) {
                                if (rows[i].timeentry_id==last) {
                                    table.focus(i, text);
                                    break;
                                }
                            }
                        } 
                        let sel = tdiv.querySelector(".selected");
                        if (sel != null) {
                            board.setBoard(sel.getAttribute("data-chat"));
                        } else {
                            board.setBoard(null);
                        }
                        prog.set(table.get());
                    }
                });
            }
        },
        columns: [
            {
                title: "Description",
                render(row) {
                    return renderTask(row, slice);
                },
                onedit(element, row, val) {
                    row.description = val;
                    mispaf.ajax({
                        url: 'students/setEntry',
                        data: {
                            slice_id: getSlice(),
                            universe_id: getUniverse(),
                            timeentry_id: row.timeentry_id,
                            description: row.description,
                            progress: row.progress,
                            length: row.length
                        }
                    })
                },
                onevent: {
                    render(event, row) {
                        if (slice.end_date != 0 || (slice.locked == 1 && row.creation == slice.start_date)) {
                            event.target.children[0].disabled=true;
                        }
                    }
                }
            },
            {
                title: "Start",
                render(row) {
                    return mispaf.escape(new Date(row.creation).toLocaleDateString());
                }
            },            {
                title: "Due/End Date",
                render(row) {
                    return '<div class="dates">' + renderDate("due_date")(row) + "</div>";
                },
                onevent: manageDates()
            },
            {
                title: "Progress",
                render(row) {
                    let presets = [0, 10, 25, 33, 50, 66, 75, 90, 100];
                    if (presets.indexOf(row.progress) == -1) {
                        presets.push(row.progress);
                        presets.sort();
                    }
                    let html = [];
                    html.push(`<select${slice.end_date != 0 ? " disabled" : ""}>`);
                    for (let i = 0; i < presets.length; i++) {
                        html.push(`<option value="${presets[i]}"${presets[i] == row.progress ? " selected" : ""}>${presets[i]} %</option>`)
                    }
                    html.push('</select>');
                    return html.join('');
                },
                onevent: {
                    'change:select'(event, row) {
                        row.progress = parseInt(event.target.value);
                        mispaf.ajax({
                            url: 'students/setEntry',
                            data: {
                                slice_id: getSlice(),
                                universe_id: getUniverse(),
                                timeentry_id: row.timeentry_id,
                                description: row.description,
                                progress: row.progress,
                                length: row.length
                            }
                        })
                        prog.set(table.get());
                    }
                }
            },
            {
                title: "Length",
                render(row) {
                    return `<input type="number" min="0" step="1" value="${row.length}"${slice.end_date != 0 ? " disabled" : ""}> min.`;
                },
                onevent: {
                    'change:input'(event, row) {
                        row.length = parseInt(event.target.value);
                        mispaf.ajax({
                            url: 'students/setEntry',
                            data: {
                                slice_id: getSlice(),
                                universe_id: getUniverse(),
                                timeentry_id: row.timeentry_id,
                                description: row.description,
                                progress: row.progress,
                                length: row.length
                            }
                        })
                        prog.set(table.get());
                    },
                    'keydown:input'(event, row) {
                        if (event.key == "Enter") {
                            event.target.blur();
                            event.preventDefault();
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
                    return `<button class="btn btn-outline-secondary btn-sm messages ${(selected == ("t" + row.timeentry_id)) ? 'selected' : ''}" data-chat="t${row.timeentry_id}" >&#128172;${count}</button>`;
                },
                onevent: {
                    async 'click:button'(event, row) {
                        if (event.target.classList.contains("selected")) {
                            selected = null;
                            event.target.classList.remove("selected");
                            board.setBoard(null);
                        } else {
                            selected = "t" + row.timeentry_id;
                            let old = tdiv.querySelector('.selected');
                            if (old) old.classList.remove("selected");
                            event.target.classList.add("selected");
                            board.setBoard(selected);
                        }
                    }
                }
            }, {
                title: "Action",
                render(row) {
                    if (slice.end_date != 0) return ""; // cannot delete after slice is closed
                    if (row.creation == slice.start_date && slice.locked == 1) return ""; // cannot delete locked slice
                    return `<button class="btn btn-outline-secondary btn-sm delete">Delete</button>`;
                },
                onevent: {
                    async 'click:button.delete'(event, row) {
                        if (await modalConfirm("Do you want to delete " + row.description + " ?")) {
                            mispaf.ajax({
                                url: "students/deleteEntry",
                                data: {
                                    timeentry_id: row.timeentry_id,
                                    slice_id: getSlice(),
                                    universe_id: getUniverse(),
                                },
                                success() {
                                    if (selected == mispaf.parentElement(event.target,"tr").querySelector("[data-chat]").getAttribute("data-chat")) {
                                        selected = null;
                                        board.setBoard(null);
                                    }
                                    table.removeRow(row);
                                    mispaf.ajaxDefault.success();
                                }
                            });
                            prog.set(table.get());
                        }
                    }
                }
            }
        ],
        onadd() {
            mispaf.ajax({
                url: "students/addEntry",
                data: {
                    universe_id: getUniverse(),
                    slice_id: slice.slice_id,
                    description: 'New Task'
                },
                success() {
                    table.refresh(true,"New Task");
                    prog.set(table.get());
                    mispaf.ajaxDefault.success();
                }
            });
        }
    })


    function refreshSlices() {
        let current = parseInt(slicesSelect.value);
        slicesSelect.innerHTML = "";
        board.setBoard(null);
        mispaf.ajax({
            url: "students/slices",
            type: 'POST',
            data: { universe_id: getUniverse() },
            success(response) {
                slicesSelect.innerHTML = "";
                slices = {};
                for (let i = 0; i < response.length; i++) {
                    slices[response[i].slice_id] = response[i];
                    let option = document.createElement("OPTION");
                    let state = [];
                    if (response[i].end_date != 0) state.push("Closed");
                    if (response[i].locked == 1) state.push("Locked");
                    if (state.length > 0) {
                        state = " (" + state.join(", ") + ")";
                    } else {
                        state = "";
                    }
                    option.innerHTML = mispaf.escape(response[i].name + state);
                    option.setAttribute("value", response[i].slice_id);
                    if (response[i].slice_id == current) {
                        option.setAttribute("selected", "true");
                    }
                    slicesSelect.appendChild(option);
                }
                slice = slices[getSlice()];
                table.refresh();
            }
        })
    }

    slicesSelect.addEventListener('change', () => {
        slice = slices[getSlice()];
        table.refresh();
    });

    mispaf.addPageListener('enter:mytasks', () => {
        board.setMyself(boardName(mispaf.user.login));
        refreshSlices();
    });
    document.getElementById('universe').addEventListener('change', () => {
        if (mispaf.page()=="mytasks") refreshSlices();
    });
})();