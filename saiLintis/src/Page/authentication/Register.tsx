import "@fortawesome/fontawesome-free/css/all.css";
import "../../LoginRegisterPage.css";
import videoBackground from "../../assets/Kny5Ty8J6mn9PsM1TGpXsWNtNh4.mp4";
import { Link,useNavigate } from "react-router-dom";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function RegisterPage() {
    const navigate=useNavigate();

    const [username,setUsername]=useState("");
    const [password,setPassword]=useState("");
    const [confirm_password,setConfPassword]=useState("");
    const [email,setEmail]=useState("");
    const [display_name,setDisplayName]=useState("");
    const [error,setError]=useState("");
    const [loading,setLoading]=useState(false)

    const handleRegister = async ()=>{
        setError("");

        if(password!==confirm_password){
            setError("Passwords do not match");
            return;
        }

        setLoading(true);

        try{
            const response=await invoke("register",{
                payload:{
                    display_name,
                    email,
                    password,
                    username
                }
            })as any;
            localStorage.setItem("token",response.token);
            navigate("/");
        }catch(err){
            setError(String(err));
        }finally{
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <video autoPlay muted loop className="video-background">
                <source src={videoBackground} type="video/mp4" />
            </video>
            <div className="wrapper">
                <form onSubmit={(e)=>{e.preventDefault(); handleRegister();}}>
                <h1>
                    Register
                </h1>

                    {error &&(<p className="auth-error">{String(error)}</p>)}

                    <div className="input-box">
                        <input type="text" value={display_name} onChange={(e)=>{setDisplayName(e.target.value);}} placeholder="Display Name" required></input>
                    </div>
                    <div className="input-box">
                        <input type="text" value={username} onChange={(e)=>{setUsername(e.target.value);}} placeholder="Username" required></input>
                    </div>
                    <div className="input-box">
                        <input type="email" value={email} onChange={(e)=>{setEmail(e.target.value);}} placeholder="Email" required></input>
                    </div>
                    <div className="input-box">
                        <input type="password" value={password} onChange={(e)=>{setPassword(e.target.value);}} placeholder="Password" required></input>
                    </div>
                    <div className="input-box">
                        <input type="password" value={confirm_password} onChange={(e)=>{setConfPassword(e.target.value);}} placeholder="Confirm password" required></input>
                    </div>
                    <div className="remember-forgot">
                    </div>
                    <button type="submit" className="btn" disabled={loading}>
                        {loading ? "Registering..." : "Register"}
                    </button>
                    <div className="register-link">
                        <p>Already have an account? <Link to="/login">Login</Link></p>
                    </div>
            </form>
            </div>
        </div>
    );
}
