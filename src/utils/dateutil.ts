const MONTH_LIST = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export function getDateTime() {
    let now = new Date();

    // let year = now.getFullYear();
    let month = now.getMonth(); // 0-11
    let day = String(now.getDate()).padStart(2, "0");

    let hours = String(now.getHours()).padStart(2, "0");
    let minutes = String(now.getMinutes()).padStart(2, "0");
    // let seconds = String(now.getSeconds()).padStart(2, "0");

    return `${MONTH_LIST[month]} ${day}  ${hours}:${minutes}`;
}