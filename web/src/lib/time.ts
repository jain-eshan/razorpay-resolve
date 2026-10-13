const IST = 'Asia/Kolkata'
// "7:52 pm", in India's time whatever the browser's timezone is.
export const clock = (iso: string) => new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: IST }).format(new Date(iso)).replace(/\s?([AP]M)/i, (_, m: string) => ` ${m.toLowerCase()}`)
export const minutesBetween = (from: string, to: string) => Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000)
