import {PaperAirplaneIcon} from "@heroicons/react/24/outline";
import {FormEvent, useEffect, useState} from "react";

export default function ChatInput({onSubmit}: {
    onSubmit: (value: string) => void,
}) {
    const [prompt, setPrompt] = useState<string>("")

    function handleSubmit(event: FormEvent) {
        event.preventDefault()
        setPrompt("")
        onSubmit(prompt)
    }

    return <form onSubmit={handleSubmit} className={"bg-gray-200 flex p-4 border-t border-t-gray-300 gap-4"}>
        <input value={prompt} onChange={event => setPrompt(event.target.value)}
               placeholder={"Send a message"} type="text"
               className={"flex-1 outline-none p-2 rounded-md border border-gray-300"}/>
        <button type={"submit"}>
            <PaperAirplaneIcon width={24} height={24}/>
        </button>
    </form>
}