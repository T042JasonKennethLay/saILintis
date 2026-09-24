import "@fortawesome/fontawesome-free/css/all.css";
import "../../LoginRegisterPage.css";
import videoBackground from "../../assets/Kny5Ty8J6mn9PsM1TGpXsWNtNh4.mp4";
import { Link,useNavigate } from "react-router-dom"
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LoadingScreen } from "../components/LoadingScreen";

export function LoginPage() {
    const navigate=useNavigate();

    const [email,setEmail]=useState("");
    const [password,setPassword]=useState("");
    const [error,setError]=useState("");
    const [loading,setLoading]=useState(false);

    const [showForgot,setShowForgot]=useState(false);
    const [forgotEmail,setForgotEmail]=useState("");
    const [forgotSend,setForgotSend]=useState(false);

    const handleLogin = async ()=>{
        setError("");
        setLoading(true);

        try{
            const response=await invoke("login",{
                payload:{ email: email.trim(), password: password.trim() }
            })as any;
            localStorage.setItem("user",JSON.stringify(response));
            const isIncomplete = !response.bio || !response.profile_picture;
            if (isIncomplete) {
                localStorage.setItem("profile_incomplete", "true");
            } else {
                localStorage.removeItem("profile_incomplete");
            }
            navigate("/home");
        }catch(err){
            setError(String(err));
        }finally{
            setLoading(false);
        }
    };

    const handleForgotPassword = async ()=>{
        if(!forgotEmail || forgotEmail.trim()===""){
            setError("Email cant be emtpy");
            return;
        }

        if(!forgotEmail.includes("@")){
            setError("Email need @");
            return;
        }

        setLoading(true);
        setError("");
        try{
            await invoke("forgot_password",{ email: forgotEmail.trim() });
            setForgotSend(true);
        }catch(e){
            setError("Failed mengirim email: "+e);
        }finally{
            setLoading(false);
        }
    };

    return (
        <>
        <div className="login-page">
        <LoadingScreen visible={loading} />
            <video autoPlay muted loop className="video-background">
                <source src={videoBackground} type="video/mp4" />
            </video>
            <div className="wrapper">
                {!showForgot ?(
                <form onSubmit={(e)=>{e.preventDefault(); handleLogin();}}>
                <h1>
                    Login
                </h1>

                    {error &&(<p className="auth-error">{error}</p>)}

                    <div className="input-box">
                        <input type="text" placeholder="Email or Employee ID" required onChange={(e)=>{setEmail(e.target.value);}}></input>
                    </div>
                    <div className="input-box">
                        <input type="password" placeholder="Password" required onChange={(e)=>{setPassword(e.target.value);}}></input>
                    </div>

                    <div className="remember-forgot">
                        <label>
                            <input type="checkbox" /> Remember me?
                        </label>
                        <a href="#" onClick={(e)=>{e.preventDefault(); setShowForgot(true);}}>Forgot password?</a>
                    </div>

                    <button type="submit" className="btn">Login</button>
                    <div className="register-link">
                        <p>Don't have an account? <Link to="/register">Register</Link></p>
                        <p className="auth-guest-prompt">
                          Or explore open postings as <Link to="/guest-dashboard" className="auth-guest-link">Guest</Link>
                        </p>
                    </div>

            </form>
            ) :!forgotSend?(
                <div className="auth-form-container">
                    <h1>Forgot Password</h1>
                    <p className="forgot-subtitle">
                        Enter your email below
                    </p>

                    {error &&(<p className="auth-error">{error}</p>)}

                    <div className="input-box">
                        <input type="email" placeholder="Email" value={forgotEmail} onChange={(e)=>{setForgotEmail(e.target.value);}}/></div>

                    <button className="btn" onClick={()=>{handleForgotPassword();}}>Send reset link</button>
                    <div className="back-link">
                        <p>
                            <a href="#" onClick={(e)=>{e.preventDefault(); setShowForgot(false);}}>Back to login</a>
                        </p>
                    </div>
                </div>

            ):(
                <div>
                    <h1>Check your email!</h1>
                    <p className="success-text">
                        Reset link sent to <strong>{forgotEmail}</strong>
                    </p>

                    <div className="back-link">
                        <p>
                            <a href="#" onClick={(e)=>{e.preventDefault(); setShowForgot(false); setForgotSend(false);}}>
                                Back to login
                            </a>
                        </p>
                    </div>
                </div>
            )}
            </div>
            </div>
        </>
    );
}
