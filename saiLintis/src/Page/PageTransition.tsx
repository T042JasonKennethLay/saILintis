import { useEffect,useState } from "react";
import "../PageTransition.css"

export function PageTransition({ children }: { children: React.ReactNode }){
    const [visible,setVisible]=useState(false);

    useEffect(()=>{
        setVisible(false);
        const t=setTimeout(()=>{
            setVisible(true);
        },20);
        return ()=>{
            clearTimeout(t);
        };
    },[]);

    return (
        <div className={`page-transition ${visible ? "page-visible" : ""}`}>
        {children}
        </div>
    );
}
