const xhrFetch = (url, options = {}) => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(options.method || "GET", url);
        if (options.headers) {
            for (const [key, value] of Object.entries(options.headers)) {
                xhr.setRequestHeader(key, value);
            }
        }
        xhr.onload = () => resolve({
            status: xhr.status,
            text: async () => xhr.responseText,
            json: async () => JSON.parse(xhr.responseText)
        });
        xhr.onerror = () => reject(new Error("XHR Load failed"));
        xhr.send(options.body || null);
    });
};

const html = await(await xhrFetch("https://www.facebook.com", { headers: { accept: "text/html" } })).text();
const token =
    /"DTSGInitialData",\[\],\{"token":"([^"]+)"/.exec(html)?.[1] ??
    /"DTSGInitData",\[\],\{"token":"([^"]+)"/.exec(html)?.[1] ??
    /.*"token":"(.*?)"/m.exec(html)?.[1];

if (!token) throw new Error("No fb_dtsg token found");

let currentUserName = "Unknown"
let userMatch = /"CurrentUserInitialData",\[\],\{[^{}]*?"NAME":"([^"]+)"/.exec(html);
if (userMatch) {
    currentUserName = userMatch[1];
}

// ... wait, the user wants currentUserData, maybe the whole object?
let currentUserData = null;
const userDataMatch = /"CurrentUserInitialData",\[\],(\{[^\]]+?\})\]/.exec(html);
if (userDataMatch) {
    try {
        currentUserData = JSON.parse(userDataMatch[1]);
    } catch (e) { }
}

const cursorValues = [
    { cursor: "-1", months: "" },
    { cursor: "0", months: "" },
    { cursor: "1", months: "" },
    { cursor: "2", months: "" },
    { cursor: "3", months: "" },
    { cursor: "4", months: "" },
    { cursor: "5", months: "" },
    { cursor: "6", months: "" },
    { cursor: "7", months: "" },
    { cursor: "8", months: "" },
    { cursor: "9", months: "" },
    { cursor: "10", months: "" },
];

const birthdaysList = [];

for (const { cursor, months } of cursorValues) {
    console.log(`Fetching ${months}...`);

    const params = new URLSearchParams();
    params.set("__a", "1");
    params.set("fb_dtsg", token);
    params.set("fb_api_caller_class", "RelayModern");
    params.set("fb_api_req_friendly_name", "BirthdayCometMonthlyBirthdaysRefetchQuery");
    params.set("variables", JSON.stringify({ count: 25, cursor: cursor }));
    params.set("server_timestamps", "true");
    params.set("doc_id", "3681233908586032");

    const res = await xhrFetch("https://www.facebook.com/api/graphql/", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: params.toString(),
    });

    const json = await res.json();

    // Extract CurrentUserInitialData from the first response if it wasn't found in HTML
    if (!currentUserData && json.extensions?.sr_payload?.ddd?.jsmods?.define) {
        const define = json.extensions.sr_payload.ddd.jsmods.define;
        const userDataEntry = define.find(item => item[0] === 'CurrentUserInitialData');
        if (userDataEntry) {
            currentUserData = userDataEntry[2];
        }
    }

    if (res.status === 200 && json.data?.viewer?.all_friends_by_birthday_month?.edges) {
        const edges = json.data.viewer.all_friends_by_birthday_month.edges;
        for (const edge of edges) {
            const friends = edge.node?.friends?.edges || [];
            for (const friendEdge of friends) {
                const friend = friendEdge.node;
                birthdaysList.push({
                    name: friend?.name || "",
                    id: friend?.id || "",
                    profileUrl: friend?.profile_url || "",
                    birthDay: friend?.birthdate?.day ? String(friend.birthdate.day) : "",
                    birthMonth: friend?.birthdate?.month ? String(friend.birthdate.month) : "",
                    birthYear: friend?.birthdate?.year ? String(friend.birthdate.year) : "",
                    pictureUrl: friend?.profile_picture?.uri || ""
                });
            }
        }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
}

const uniqueBirthdaysList = Array.from(
    new Map(birthdaysList.map(item => [item.profileUrl, item])).values()
);

window.birthdaysList = uniqueBirthdaysList;

return {
    "currentUser": currentUserData,
    "contacts": uniqueBirthdaysList
};