const bcrypt = require("bcrypt");
const config=require("../config.js");

module.exports = ({HTTPError, model, setUser, user, clearUser}) => {
    return  {
        async login(params) {
            let user = await model.users.getByLogin(params.login);
            if (user && await bcrypt.compare(params.password, user.password) && user.validated==1) {
                setUser({ login: user.login, admin: user.admin == 1, superadmin:(user.superadmin==1 && user.admin==1), validated: user.validated == 1, user_id: user.user_id });
            } else {
                throw new HTTPError("Invalid user/password", 403);
            }
        },
        async register(params) {
            params.password1 = params.password1.trim();
            if (params.password1 == "") {
                throw new HTTPError("Missing password.", 422);
            } else if (params.password1 != params.password2) {
                throw new HTTPError("Passwords are different.", 422);
            } else if (params.password1.length < 8) {
                throw new HTTPError("Password is too short (8+).", 422);
            }
            let valid = false;
            let email=params.login;
            for (let i = 0; i < config.emails.length; i++) {
                if (email.endsWith(config.emails[i])) {
                    let short = email.substring(0, email.length - config.emails[i].length);
                    if (short.indexOf(" ") != -1) break; // cannot contain space
                    if (short.length == 0) break; // empty email
                    let ishort = parseInt(short);
                    if (!isNaN(ishort) && (ishort + "" == short)) {
                        break; // number only email
                    }
                    valid = true; // found something we can allow
                    break;
                }
            }
            if (!valid) {
                throw new HTTPError("Invalid email (no numbers, "+config.emails.join(', ')+")", 422);            
            }
            if (await model.users.getByLogin(params.login)!=null) {
                throw new HTTPError("Login already exists", 422);            
            }
            let hash = await bcrypt.hash(params.password1, 10);
            let uid=await model.users.register({ login: params.login, password: hash });
            // set universe
            let universe=parseInt(params.universe);
            if (!(isNaN(universe))) {
                universe=await model.universes.getByID(universe);
                if (universe.active==1 && universe.registrable==1) {
                    await model.users.setUniverses(uid, [universe.universe_id]);
                }
            }
            //auto signin
            if (!user) {
                setUser({ login: params.login, admin: false, validated: true, user_id: uid });
            }
        },
        async whoami() {
            if (user && user.validated) {
                return user;
            } else {
                return null;
            }
        },
        async whoamiadmin() {
            if (user && user.admin) return user;
            return null;
        },
        async logout() {
            clearUser();
        },
        async universes() {
            return await model.universes.getRegistrable();
        },
        async changePassword(params) {
            if (user.validated !== true) throw new HTTPError("Access Denied", 403)
            let dbuser=await model.users.getById(user.user_id);
            if (dbuser && await bcrypt.compare(params.password, dbuser.password) && dbuser.validated==1) {
                params.password1 = params.password1.trim();
                if (params.password1 == "") {
                    throw new HTTPError("Missing password.", 422);
                } else if (params.password1 != params.password2) {
                    throw new HTTPError("Passwords are different.", 422);
                } else if (params.password1.length < 8) {
                    throw new HTTPError("Password is too short (8+).", 422);
                }
                let hash = await bcrypt.hash(params.password1, 10);
                await model.users.updatePassword(user.user_id, hash);
            } else {
                throw new HTTPError("Invalid user/password", 403);
            }
        },
        async kanbanTypes() {
            return await model.groups.kanbanTypes();
        }
    }
}
