(()=>{var bh=0,zl=1,Th=2;var Gi=1,Eh=2,Ts=3,Qn=0,rn=1,qe=2,Vn=0,jn=1,kl=2,Vl=3,Hl=4,wh=5;var xi=100,Ah=101,Rh=102,Ch=103,Ph=104,Ih=200,Lh=201,Dh=202,Nh=203,ra=204,aa=205,Uh=206,Fh=207,Oh=208,Bh=209,zh=210,kh=211,Vh=212,Hh=213,Gh=214,oa=0,la=1,ca=2,zi=3,ha=4,ua=5,da=6,fa=7,Gl=0,Wh=1,Xh=2,Cn=0,Wl=1,Xl=2,ql=3,yr=4,Yl=5,Zl=6,Kl=7;var Jl=300,Ti=301,Wi=302,Es=303,Wa=304,Mr=306,ti=1e3,Fn=1001,pa=1002,ke=1003,qh=1004;var Sr=1005;var Xe=1006,Xa=1007;var Ei=1008;var on=1009,$l=1010,Ql=1011,ws=1012,qa=1013,Pn=1014,In=1015,Hn=1016,Ya=1017,Za=1018,As=1020,jl=35902,tc=35899,ec=1021,nc=1022,Mn=1023,On=1026,wi=1027,ic=1028,Ka=1029,Ai=1030,Ja=1031;var $a=1033,br=33776,Tr=33777,Er=33778,wr=33779,Qa=35840,ja=35841,to=35842,eo=35843,no=36196,io=37492,so=37496,ro=37488,ao=37489,Ar=37490,oo=37491,lo=37808,co=37809,ho=37810,uo=37811,fo=37812,po=37813,mo=37814,go=37815,_o=37816,xo=37817,vo=37818,yo=37819,Mo=37820,So=37821,bo=36492,To=36494,Eo=36495,wo=36283,Ao=36284,Rr=36285,Ro=36286;var qs=2300,ma=2301,sa=2302,Sl=2303,bl=2400,Tl=2401,El=2402;var Yh=3200;var Co=0,Zh=1,ai="",Se="srgb",Ys="srgb-linear",Zs="linear",de="srgb";var Fi=7680;var wl=519,Kh=512,Jh=513,$h=514,Po=515,Qh=516,jh=517,Io=518,tu=519,Al=35044;var sc="300 es",wn=2e3,ds=2001;function _d(i){for(let t=i.length-1;t>=0;--t)if(i[t]>=65535)return!0;return!1}function xd(i){return ArrayBuffer.isView(i)&&!(i instanceof DataView)}function Ks(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function eu(){let i=Ks("canvas");return i.style.display="block",i}var Yc={},fs=null;function rc(...i){let t="THREE."+i.shift();fs?fs("log",t,...i):console.log(t,...i)}function nu(i){let t=i[0];if(typeof t=="string"&&t.startsWith("TSL:")){let e=i[1];e&&e.isStackTrace?i[0]+=" "+e.getLocation():i[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return i}function Gt(...i){i=nu(i);let t="THREE."+i.shift();if(fs)fs("warn",t,...i);else{let e=i[0];e&&e.isStackTrace?console.warn(e.getError(t)):console.warn(t,...i)}}function Ht(...i){i=nu(i);let t="THREE."+i.shift();if(fs)fs("error",t,...i);else{let e=i[0];e&&e.isStackTrace?console.error(e.getError(t)):console.error(t,...i)}}function Bi(...i){let t=i.join(" ");t in Yc||(Yc[t]=!0,Gt(...i))}function iu(i,t,e){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(t,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,e);break;default:n()}}setTimeout(r,e)})}var su={[oa]:la,[ca]:da,[ha]:fa,[zi]:ua,[la]:oa,[da]:ca,[fa]:ha,[ua]:zi},Bn=class{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){let n=this._listeners;return n===void 0?!1:n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){let n=this._listeners;if(n===void 0)return;let s=n[t];if(s!==void 0){let r=s.indexOf(e);r!==-1&&s.splice(r,1)}}dispatchEvent(t){let e=this._listeners;if(e===void 0)return;let n=e[t.type];if(n!==void 0){t.target=this;let s=n.slice(0);for(let r=0,a=s.length;r<a;r++)s[r].call(this,t);t.target=null}}},Ke=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];var Ko=Math.PI/180,Js=180/Math.PI;function Rs(){let i=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Ke[i&255]+Ke[i>>8&255]+Ke[i>>16&255]+Ke[i>>24&255]+"-"+Ke[t&255]+Ke[t>>8&255]+"-"+Ke[t>>16&15|64]+Ke[t>>24&255]+"-"+Ke[e&63|128]+Ke[e>>8&255]+"-"+Ke[e>>16&255]+Ke[e>>24&255]+Ke[n&255]+Ke[n>>8&255]+Ke[n>>16&255]+Ke[n>>24&255]).toLowerCase()}function ie(i,t,e){return Math.max(t,Math.min(e,i))}function vd(i,t){return(i%t+t)%t}function Jo(i,t,e){return(1-e)*i+e*t}function Bs(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function an(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var uc=class uc{constructor(t=0,e=0){this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("THREE.Vector2: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){let e=this.x,n=this.y,s=t.elements;return this.x=s[0]*e+s[3]*n+s[6],this.y=s[1]*e+s[4]*n+s[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=ie(this.x,t.x,e.x),this.y=ie(this.y,t.y,e.y),this}clampScalar(t,e){return this.x=ie(this.x,t,e),this.y=ie(this.y,t,e),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(ie(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let n=this.dot(t)/e;return Math.acos(ie(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,n=this.y-t.y;return e*e+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){let n=Math.cos(e),s=Math.sin(e),r=this.x-t.x,a=this.y-t.y;return this.x=r*n-a*s+t.x,this.y=r*s+a*n+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}};uc.prototype.isVector2=!0;var ht=uc,zn=class{constructor(t=0,e=0,n=0,s=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=n,this._w=s}static slerpFlat(t,e,n,s,r,a,o){let l=n[s+0],c=n[s+1],h=n[s+2],d=n[s+3],u=r[a+0],f=r[a+1],m=r[a+2],y=r[a+3];if(d!==y||l!==u||c!==f||h!==m){let p=l*u+c*f+h*m+d*y;p<0&&(u=-u,f=-f,m=-m,y=-y,p=-p);let g=1-o;if(p<.9995){let S=Math.acos(p),b=Math.sin(S);g=Math.sin(g*S)/b,o=Math.sin(o*S)/b,l=l*g+u*o,c=c*g+f*o,h=h*g+m*o,d=d*g+y*o}else{l=l*g+u*o,c=c*g+f*o,h=h*g+m*o,d=d*g+y*o;let S=1/Math.sqrt(l*l+c*c+h*h+d*d);l*=S,c*=S,h*=S,d*=S}}t[e]=l,t[e+1]=c,t[e+2]=h,t[e+3]=d}static multiplyQuaternionsFlat(t,e,n,s,r,a){let o=n[s],l=n[s+1],c=n[s+2],h=n[s+3],d=r[a],u=r[a+1],f=r[a+2],m=r[a+3];return t[e]=o*m+h*d+l*f-c*u,t[e+1]=l*m+h*u+c*d-o*f,t[e+2]=c*m+h*f+o*u-l*d,t[e+3]=h*m-o*d-l*u-c*f,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,n,s){return this._x=t,this._y=e,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){let n=t._x,s=t._y,r=t._z,a=t._order,o=Math.cos,l=Math.sin,c=o(n/2),h=o(s/2),d=o(r/2),u=l(n/2),f=l(s/2),m=l(r/2);switch(a){case"XYZ":this._x=u*h*d+c*f*m,this._y=c*f*d-u*h*m,this._z=c*h*m+u*f*d,this._w=c*h*d-u*f*m;break;case"YXZ":this._x=u*h*d+c*f*m,this._y=c*f*d-u*h*m,this._z=c*h*m-u*f*d,this._w=c*h*d+u*f*m;break;case"ZXY":this._x=u*h*d-c*f*m,this._y=c*f*d+u*h*m,this._z=c*h*m+u*f*d,this._w=c*h*d-u*f*m;break;case"ZYX":this._x=u*h*d-c*f*m,this._y=c*f*d+u*h*m,this._z=c*h*m-u*f*d,this._w=c*h*d+u*f*m;break;case"YZX":this._x=u*h*d+c*f*m,this._y=c*f*d+u*h*m,this._z=c*h*m-u*f*d,this._w=c*h*d-u*f*m;break;case"XZY":this._x=u*h*d-c*f*m,this._y=c*f*d-u*h*m,this._z=c*h*m+u*f*d,this._w=c*h*d+u*f*m;break;default:Gt("Quaternion: .setFromEuler() encountered an unknown order: "+a)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){let n=e/2,s=Math.sin(n);return this._x=t.x*s,this._y=t.y*s,this._z=t.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(t){let e=t.elements,n=e[0],s=e[4],r=e[8],a=e[1],o=e[5],l=e[9],c=e[2],h=e[6],d=e[10],u=n+o+d;if(u>0){let f=.5/Math.sqrt(u+1);this._w=.25/f,this._x=(h-l)*f,this._y=(r-c)*f,this._z=(a-s)*f}else if(n>o&&n>d){let f=2*Math.sqrt(1+n-o-d);this._w=(h-l)/f,this._x=.25*f,this._y=(s+a)/f,this._z=(r+c)/f}else if(o>d){let f=2*Math.sqrt(1+o-n-d);this._w=(r-c)/f,this._x=(s+a)/f,this._y=.25*f,this._z=(l+h)/f}else{let f=2*Math.sqrt(1+d-n-o);this._w=(a-s)/f,this._x=(r+c)/f,this._y=(l+h)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let n=t.dot(e)+1;return n<1e-8?(n=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=n):(this._x=0,this._y=-t.z,this._z=t.y,this._w=n)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=n),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(ie(this.dot(t),-1,1)))}rotateTowards(t,e){let n=this.angleTo(t);if(n===0)return this;let s=Math.min(1,e/n);return this.slerp(t,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){let n=t._x,s=t._y,r=t._z,a=t._w,o=e._x,l=e._y,c=e._z,h=e._w;return this._x=n*h+a*o+s*c-r*l,this._y=s*h+a*l+r*o-n*c,this._z=r*h+a*c+n*l-s*o,this._w=a*h-n*o-s*l-r*c,this._onChangeCallback(),this}slerp(t,e){let n=t._x,s=t._y,r=t._z,a=t._w,o=this.dot(t);o<0&&(n=-n,s=-s,r=-r,a=-a,o=-o);let l=1-e;if(o<.9995){let c=Math.acos(o),h=Math.sin(c);l=Math.sin(l*c)/h,e=Math.sin(e*c)/h,this._x=this._x*l+n*e,this._y=this._y*l+s*e,this._z=this._z*l+r*e,this._w=this._w*l+a*e,this._onChangeCallback()}else this._x=this._x*l+n*e,this._y=this._y*l+s*e,this._z=this._z*l+r*e,this._w=this._w*l+a*e,this.normalize();return this}slerpQuaternions(t,e,n){return this.copy(t).slerp(e,n)}random(){let t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(t),s*Math.cos(t),r*Math.sin(e),r*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},dc=class dc{constructor(t=0,e=0,n=0){this.x=t,this.y=e,this.z=n}set(t,e,n){return n===void 0&&(n=this.z),this.x=t,this.y=e,this.z=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("THREE.Vector3: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(Zc.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(Zc.setFromAxisAngle(t,e))}applyMatrix3(t){let e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[3]*n+r[6]*s,this.y=r[1]*e+r[4]*n+r[7]*s,this.z=r[2]*e+r[5]*n+r[8]*s,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){let e=this.x,n=this.y,s=this.z,r=t.elements,a=1/(r[3]*e+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*e+r[4]*n+r[8]*s+r[12])*a,this.y=(r[1]*e+r[5]*n+r[9]*s+r[13])*a,this.z=(r[2]*e+r[6]*n+r[10]*s+r[14])*a,this}applyQuaternion(t){let e=this.x,n=this.y,s=this.z,r=t.x,a=t.y,o=t.z,l=t.w,c=2*(a*s-o*n),h=2*(o*e-r*s),d=2*(r*n-a*e);return this.x=e+l*c+a*d-o*h,this.y=n+l*h+o*c-r*d,this.z=s+l*d+r*h-a*c,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){let e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[4]*n+r[8]*s,this.y=r[1]*e+r[5]*n+r[9]*s,this.z=r[2]*e+r[6]*n+r[10]*s,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=ie(this.x,t.x,e.x),this.y=ie(this.y,t.y,e.y),this.z=ie(this.z,t.z,e.z),this}clampScalar(t,e){return this.x=ie(this.x,t,e),this.y=ie(this.y,t,e),this.z=ie(this.z,t,e),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(ie(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){let n=t.x,s=t.y,r=t.z,a=e.x,o=e.y,l=e.z;return this.x=s*l-r*o,this.y=r*a-n*l,this.z=n*o-s*a,this}projectOnVector(t){let e=t.lengthSq();if(e===0)return this.set(0,0,0);let n=t.dot(this)/e;return this.copy(t).multiplyScalar(n)}projectOnPlane(t){return $o.copy(this).projectOnVector(t),this.sub($o)}reflect(t){return this.sub($o.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let n=this.dot(t)/e;return Math.acos(ie(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,n=this.y-t.y,s=this.z-t.z;return e*e+n*n+s*s}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,n){let s=Math.sin(e)*t;return this.x=s*Math.sin(n),this.y=Math.cos(e)*t,this.z=s*Math.cos(n),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,n){return this.x=t*Math.sin(e),this.y=n,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){let e=this.setFromMatrixColumn(t,0).length(),n=this.setFromMatrixColumn(t,1).length(),s=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=n,this.z=s,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let t=Math.random()*Math.PI*2,e=Math.random()*2-1,n=Math.sqrt(1-e*e);return this.x=n*Math.cos(t),this.y=e,this.z=n*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}};dc.prototype.isVector3=!0;var I=dc,$o=new I,Zc=new zn,fc=class fc{constructor(t,e,n,s,r,a,o,l,c){this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,a,o,l,c)}set(t,e,n,s,r,a,o,l,c){let h=this.elements;return h[0]=t,h[1]=s,h[2]=o,h[3]=e,h[4]=r,h[5]=l,h[6]=n,h[7]=a,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){let e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],this}extractBasis(t,e,n){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(t){let e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let n=t.elements,s=e.elements,r=this.elements,a=n[0],o=n[3],l=n[6],c=n[1],h=n[4],d=n[7],u=n[2],f=n[5],m=n[8],y=s[0],p=s[3],g=s[6],S=s[1],b=s[4],v=s[7],w=s[2],T=s[5],R=s[8];return r[0]=a*y+o*S+l*w,r[3]=a*p+o*b+l*T,r[6]=a*g+o*v+l*R,r[1]=c*y+h*S+d*w,r[4]=c*p+h*b+d*T,r[7]=c*g+h*v+d*R,r[2]=u*y+f*S+m*w,r[5]=u*p+f*b+m*T,r[8]=u*g+f*v+m*R,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8];return e*a*h-e*o*c-n*r*h+n*o*l+s*r*c-s*a*l}invert(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8],d=h*a-o*c,u=o*l-h*r,f=c*r-a*l,m=e*d+n*u+s*f;if(m===0)return this.set(0,0,0,0,0,0,0,0,0);let y=1/m;return t[0]=d*y,t[1]=(s*c-h*n)*y,t[2]=(o*n-s*a)*y,t[3]=u*y,t[4]=(h*e-s*l)*y,t[5]=(s*r-o*e)*y,t[6]=f*y,t[7]=(n*l-c*e)*y,t[8]=(a*e-n*r)*y,this}transpose(){let t,e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){let e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,n,s,r,a,o){let l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*a+c*o)+a+t,-s*c,s*l,-s*(-c*a+l*o)+o+e,0,0,1),this}scale(t,e){return Bi("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(Qo.makeScale(t,e)),this}rotate(t){return Bi("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(Qo.makeRotation(-t)),this}translate(t,e){return Bi("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(Qo.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,n,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){let e=this.elements,n=t.elements;for(let s=0;s<9;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<9;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){let n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t}clone(){return new this.constructor().fromArray(this.elements)}};fc.prototype.isMatrix3=!0;var qt=fc,Qo=new qt,Kc=new qt().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Jc=new qt().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function yd(){let i={enabled:!0,workingColorSpace:Ys,spaces:{},convert:function(s,r,a){return this.enabled===!1||r===a||!r||!a||(this.spaces[r].transfer===de&&(s.r=$n(s.r),s.g=$n(s.g),s.b=$n(s.b)),this.spaces[r].primaries!==this.spaces[a].primaries&&(s.applyMatrix3(this.spaces[r].toXYZ),s.applyMatrix3(this.spaces[a].fromXYZ)),this.spaces[a].transfer===de&&(s.r=us(s.r),s.g=us(s.g),s.b=us(s.b))),s},workingToColorSpace:function(s,r){return this.convert(s,this.workingColorSpace,r)},colorSpaceToWorking:function(s,r){return this.convert(s,r,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===ai?Zs:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,r=this.workingColorSpace){return s.fromArray(this.spaces[r].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,r,a){return s.copy(this.spaces[r].toXYZ).multiply(this.spaces[a].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(s,r){return Bi("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),i.workingToColorSpace(s,r)},toWorkingColorSpace:function(s,r){return Bi("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),i.colorSpaceToWorking(s,r)}},t=[.64,.33,.3,.6,.15,.06],e=[.2126,.7152,.0722],n=[.3127,.329];return i.define({[Ys]:{primaries:t,whitePoint:n,transfer:Zs,toXYZ:Kc,fromXYZ:Jc,luminanceCoefficients:e,workingColorSpaceConfig:{unpackColorSpace:Se},outputColorSpaceConfig:{drawingBufferColorSpace:Se}},[Se]:{primaries:t,whitePoint:n,transfer:de,toXYZ:Kc,fromXYZ:Jc,luminanceCoefficients:e,outputColorSpaceConfig:{drawingBufferColorSpace:Se}}}),i}var se=yd();function $n(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function us(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}var ji,ga=class{static getDataURL(t,e="image/png"){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement=="undefined")return t.src;let n;if(t instanceof HTMLCanvasElement)n=t;else{ji===void 0&&(ji=Ks("canvas")),ji.width=t.width,ji.height=t.height;let s=ji.getContext("2d");t instanceof ImageData?s.putImageData(t,0,0):s.drawImage(t,0,0,t.width,t.height),n=ji}return n.toDataURL(e)}static sRGBToLinear(t){if(typeof HTMLImageElement!="undefined"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement!="undefined"&&t instanceof HTMLCanvasElement||typeof ImageBitmap!="undefined"&&t instanceof ImageBitmap){let e=Ks("canvas");e.width=t.width,e.height=t.height;let n=e.getContext("2d");n.drawImage(t,0,0,t.width,t.height);let s=n.getImageData(0,0,t.width,t.height),r=s.data;for(let a=0;a<r.length;a++)r[a]=$n(r[a]/255)*255;return n.putImageData(s,0,0),e}else if(t.data){let e=t.data.slice(0);for(let n=0;n<e.length;n++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[n]=Math.floor($n(e[n]/255)*255):e[n]=$n(e[n]);return{data:e,width:t.width,height:t.height}}else return Gt("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}},Md=0,ps=class{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:Md++}),this.uuid=Rs(),this.data=t,this.dataReady=!0,this.version=0}getSize(t){let e=this.data;return typeof HTMLVideoElement!="undefined"&&e instanceof HTMLVideoElement?t.set(e.videoWidth,e.videoHeight,0):typeof VideoFrame!="undefined"&&e instanceof VideoFrame?t.set(e.displayWidth,e.displayHeight,0):e!==null?t.set(e.width,e.height,e.depth||0):t.set(0,0,0),t}set needsUpdate(t){t===!0&&this.version++}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];let n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let a=0,o=s.length;a<o;a++)s[a].isDataTexture?r.push(jo(s[a].image)):r.push(jo(s[a]))}else r=jo(s);n.url=r}return e||(t.images[this.uuid]=n),n}};function jo(i){return typeof HTMLImageElement!="undefined"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement!="undefined"&&i instanceof HTMLCanvasElement||typeof ImageBitmap!="undefined"&&i instanceof ImageBitmap?ga.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(Gt("Texture: Unable to serialize Texture."),{})}var Sd=0,tl=new I,nn=class i extends Bn{constructor(t=i.DEFAULT_IMAGE,e=i.DEFAULT_MAPPING,n=Fn,s=Fn,r=Xe,a=Ei,o=Mn,l=on,c=i.DEFAULT_ANISOTROPY,h=ai){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Sd++}),this.uuid=Rs(),this.name="",this.source=new ps(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new ht(0,0),this.repeat=new ht(1,1),this.center=new ht(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new qt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(t&&t.depth&&t.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(tl).x}get height(){return this.source.getSize(tl).y}get depth(){return this.source.getSize(tl).z}get image(){return this.source.data}set image(t){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.normalized=t.normalized,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.renderTarget=t.renderTarget,this.isRenderTargetTexture=t.isRenderTargetTexture,this.isArrayTexture=t.isArrayTexture,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}setValues(t){for(let e in t){let n=t[e];if(n===void 0){Gt(`Texture.setValues(): parameter '${e}' has value of undefined.`);continue}let s=this[e];if(s===void 0){Gt(`Texture.setValues(): property '${e}' does not exist.`);continue}s&&n&&s.isVector2&&n.isVector2||s&&n&&s.isVector3&&n.isVector3||s&&n&&s.isMatrix3&&n.isMatrix3?s.copy(n):this[e]=n}}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];let n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),e||(t.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==Jl)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case ti:t.x=t.x-Math.floor(t.x);break;case Fn:t.x=t.x<0?0:1;break;case pa:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case ti:t.y=t.y-Math.floor(t.y);break;case Fn:t.y=t.y<0?0:1;break;case pa:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}};nn.DEFAULT_IMAGE=null;nn.DEFAULT_MAPPING=Jl;nn.DEFAULT_ANISOTROPY=1;var pc=class pc{constructor(t=0,e=0,n=0,s=1){this.x=t,this.y=e,this.z=n,this.w=s}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,n,s){return this.x=t,this.y=e,this.z=n,this.w=s,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("THREE.Vector4: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){let e=this.x,n=this.y,s=this.z,r=this.w,a=t.elements;return this.x=a[0]*e+a[4]*n+a[8]*s+a[12]*r,this.y=a[1]*e+a[5]*n+a[9]*s+a[13]*r,this.z=a[2]*e+a[6]*n+a[10]*s+a[14]*r,this.w=a[3]*e+a[7]*n+a[11]*s+a[15]*r,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);let e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,n,s,r,l=t.elements,c=l[0],h=l[4],d=l[8],u=l[1],f=l[5],m=l[9],y=l[2],p=l[6],g=l[10];if(Math.abs(h-u)<.01&&Math.abs(d-y)<.01&&Math.abs(m-p)<.01){if(Math.abs(h+u)<.1&&Math.abs(d+y)<.1&&Math.abs(m+p)<.1&&Math.abs(c+f+g-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;let b=(c+1)/2,v=(f+1)/2,w=(g+1)/2,T=(h+u)/4,R=(d+y)/4,_=(m+p)/4;return b>v&&b>w?b<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(b),s=T/n,r=R/n):v>w?v<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(v),n=T/s,r=_/s):w<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(w),n=R/r,s=_/r),this.set(n,s,r,e),this}let S=Math.sqrt((p-m)*(p-m)+(d-y)*(d-y)+(u-h)*(u-h));return Math.abs(S)<.001&&(S=1),this.x=(p-m)/S,this.y=(d-y)/S,this.z=(u-h)/S,this.w=Math.acos((c+f+g-1)/2),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=ie(this.x,t.x,e.x),this.y=ie(this.y,t.y,e.y),this.z=ie(this.z,t.z,e.z),this.w=ie(this.w,t.w,e.w),this}clampScalar(t,e){return this.x=ie(this.x,t,e),this.y=ie(this.y,t,e),this.z=ie(this.z,t,e),this.w=ie(this.w,t,e),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(ie(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this.w=t.w+(e.w-t.w)*n,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}};pc.prototype.isVector4=!0;var Te=pc,_a=class extends Bn{constructor(t=1,e=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Xe,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=n.depth,this.scissor=new Te(0,0,t,e),this.scissorTest=!1,this.viewport=new Te(0,0,t,e),this.textures=[];let s={width:t,height:e,depth:n.depth},r=new nn(s),a=n.count;for(let o=0;o<a;o++)this.textures[o]=r.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(t={}){let e={minFilter:Xe,generateMipmaps:!1,flipY:!1,internalFormat:null};t.mapping!==void 0&&(e.mapping=t.mapping),t.wrapS!==void 0&&(e.wrapS=t.wrapS),t.wrapT!==void 0&&(e.wrapT=t.wrapT),t.wrapR!==void 0&&(e.wrapR=t.wrapR),t.magFilter!==void 0&&(e.magFilter=t.magFilter),t.minFilter!==void 0&&(e.minFilter=t.minFilter),t.format!==void 0&&(e.format=t.format),t.type!==void 0&&(e.type=t.type),t.anisotropy!==void 0&&(e.anisotropy=t.anisotropy),t.colorSpace!==void 0&&(e.colorSpace=t.colorSpace),t.flipY!==void 0&&(e.flipY=t.flipY),t.generateMipmaps!==void 0&&(e.generateMipmaps=t.generateMipmaps),t.internalFormat!==void 0&&(e.internalFormat=t.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(e)}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}set depthTexture(t){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),t!==null&&(t.renderTarget=this),this._depthTexture=t}get depthTexture(){return this._depthTexture}setSize(t,e,n=1){if(this.width!==t||this.height!==e||this.depth!==n){this.width=t,this.height=e,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=t,this.textures[s].image.height=e,this.textures[s].image.depth=n,this.textures[s].isData3DTexture!==!0&&(this.textures[s].isArrayTexture=this.textures[s].image.depth>1);this.dispose()}this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let e=0,n=t.textures.length;e<n;e++){this.textures[e]=t.textures[e].clone(),this.textures[e].isRenderTargetTexture=!0,this.textures[e].renderTarget=this;let s=Object.assign({},t.textures[e].image);this.textures[e].source=new ps(s)}return this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this.multiview=t.multiview,this.useArrayDepthTexture=t.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},fn=class extends _a{constructor(t=1,e=1,n={}){super(t,e,n),this.isWebGLRenderTarget=!0}},$s=class extends nn{constructor(t=null,e=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=ke,this.minFilter=ke,this.wrapR=Fn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}};var xa=class extends nn{constructor(t=null,e=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=ke,this.minFilter=ke,this.wrapR=Fn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Ga=class Ga{constructor(t,e,n,s,r,a,o,l,c,h,d,u,f,m,y,p){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,a,o,l,c,h,d,u,f,m,y,p)}set(t,e,n,s,r,a,o,l,c,h,d,u,f,m,y,p){let g=this.elements;return g[0]=t,g[4]=e,g[8]=n,g[12]=s,g[1]=r,g[5]=a,g[9]=o,g[13]=l,g[2]=c,g[6]=h,g[10]=d,g[14]=u,g[3]=f,g[7]=m,g[11]=y,g[15]=p,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new Ga().fromArray(this.elements)}copy(t){let e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],e[9]=n[9],e[10]=n[10],e[11]=n[11],e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15],this}copyPosition(t){let e=this.elements,n=t.elements;return e[12]=n[12],e[13]=n[13],e[14]=n[14],this}setFromMatrix3(t){let e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,n){return this.determinantAffine()===0?(t.set(1,0,0),e.set(0,1,0),n.set(0,0,1),this):(t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(t,e,n){return this.set(t.x,e.x,n.x,0,t.y,e.y,n.y,0,t.z,e.z,n.z,0,0,0,0,1),this}extractRotation(t){if(t.determinantAffine()===0)return this.identity();let e=this.elements,n=t.elements,s=1/ts.setFromMatrixColumn(t,0).length(),r=1/ts.setFromMatrixColumn(t,1).length(),a=1/ts.setFromMatrixColumn(t,2).length();return e[0]=n[0]*s,e[1]=n[1]*s,e[2]=n[2]*s,e[3]=0,e[4]=n[4]*r,e[5]=n[5]*r,e[6]=n[6]*r,e[7]=0,e[8]=n[8]*a,e[9]=n[9]*a,e[10]=n[10]*a,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){let e=this.elements,n=t.x,s=t.y,r=t.z,a=Math.cos(n),o=Math.sin(n),l=Math.cos(s),c=Math.sin(s),h=Math.cos(r),d=Math.sin(r);if(t.order==="XYZ"){let u=a*h,f=a*d,m=o*h,y=o*d;e[0]=l*h,e[4]=-l*d,e[8]=c,e[1]=f+m*c,e[5]=u-y*c,e[9]=-o*l,e[2]=y-u*c,e[6]=m+f*c,e[10]=a*l}else if(t.order==="YXZ"){let u=l*h,f=l*d,m=c*h,y=c*d;e[0]=u+y*o,e[4]=m*o-f,e[8]=a*c,e[1]=a*d,e[5]=a*h,e[9]=-o,e[2]=f*o-m,e[6]=y+u*o,e[10]=a*l}else if(t.order==="ZXY"){let u=l*h,f=l*d,m=c*h,y=c*d;e[0]=u-y*o,e[4]=-a*d,e[8]=m+f*o,e[1]=f+m*o,e[5]=a*h,e[9]=y-u*o,e[2]=-a*c,e[6]=o,e[10]=a*l}else if(t.order==="ZYX"){let u=a*h,f=a*d,m=o*h,y=o*d;e[0]=l*h,e[4]=m*c-f,e[8]=u*c+y,e[1]=l*d,e[5]=y*c+u,e[9]=f*c-m,e[2]=-c,e[6]=o*l,e[10]=a*l}else if(t.order==="YZX"){let u=a*l,f=a*c,m=o*l,y=o*c;e[0]=l*h,e[4]=y-u*d,e[8]=m*d+f,e[1]=d,e[5]=a*h,e[9]=-o*h,e[2]=-c*h,e[6]=f*d+m,e[10]=u-y*d}else if(t.order==="XZY"){let u=a*l,f=a*c,m=o*l,y=o*c;e[0]=l*h,e[4]=-d,e[8]=c*h,e[1]=u*d+y,e[5]=a*h,e[9]=f*d-m,e[2]=m*d-f,e[6]=o*h,e[10]=y*d+u}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(bd,t,Td)}lookAt(t,e,n){let s=this.elements;return un.subVectors(t,e),un.lengthSq()===0&&(un.z=1),un.normalize(),ui.crossVectors(n,un),ui.lengthSq()===0&&(Math.abs(n.z)===1?un.x+=1e-4:un.z+=1e-4,un.normalize(),ui.crossVectors(n,un)),ui.normalize(),Nr.crossVectors(un,ui),s[0]=ui.x,s[4]=Nr.x,s[8]=un.x,s[1]=ui.y,s[5]=Nr.y,s[9]=un.y,s[2]=ui.z,s[6]=Nr.z,s[10]=un.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let n=t.elements,s=e.elements,r=this.elements,a=n[0],o=n[4],l=n[8],c=n[12],h=n[1],d=n[5],u=n[9],f=n[13],m=n[2],y=n[6],p=n[10],g=n[14],S=n[3],b=n[7],v=n[11],w=n[15],T=s[0],R=s[4],_=s[8],E=s[12],P=s[1],C=s[5],D=s[9],W=s[13],X=s[2],O=s[6],H=s[10],V=s[14],K=s[3],et=s[7],ot=s[11],ct=s[15];return r[0]=a*T+o*P+l*X+c*K,r[4]=a*R+o*C+l*O+c*et,r[8]=a*_+o*D+l*H+c*ot,r[12]=a*E+o*W+l*V+c*ct,r[1]=h*T+d*P+u*X+f*K,r[5]=h*R+d*C+u*O+f*et,r[9]=h*_+d*D+u*H+f*ot,r[13]=h*E+d*W+u*V+f*ct,r[2]=m*T+y*P+p*X+g*K,r[6]=m*R+y*C+p*O+g*et,r[10]=m*_+y*D+p*H+g*ot,r[14]=m*E+y*W+p*V+g*ct,r[3]=S*T+b*P+v*X+w*K,r[7]=S*R+b*C+v*O+w*et,r[11]=S*_+b*D+v*H+w*ot,r[15]=S*E+b*W+v*V+w*ct,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){let t=this.elements,e=t[0],n=t[4],s=t[8],r=t[12],a=t[1],o=t[5],l=t[9],c=t[13],h=t[2],d=t[6],u=t[10],f=t[14],m=t[3],y=t[7],p=t[11],g=t[15],S=l*f-c*u,b=o*f-c*d,v=o*u-l*d,w=a*f-c*h,T=a*u-l*h,R=a*d-o*h;return e*(y*S-p*b+g*v)-n*(m*S-p*w+g*T)+s*(m*b-y*w+g*R)-r*(m*v-y*T+p*R)}determinantAffine(){let t=this.elements,e=t[0],n=t[4],s=t[8],r=t[1],a=t[5],o=t[9],l=t[2],c=t[6],h=t[10];return e*(a*h-o*c)-n*(r*h-o*l)+s*(r*c-a*l)}transpose(){let t=this.elements,e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,n){let s=this.elements;return t.isVector3?(s[12]=t.x,s[13]=t.y,s[14]=t.z):(s[12]=t,s[13]=e,s[14]=n),this}invert(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8],d=t[9],u=t[10],f=t[11],m=t[12],y=t[13],p=t[14],g=t[15],S=e*o-n*a,b=e*l-s*a,v=e*c-r*a,w=n*l-s*o,T=n*c-r*o,R=s*c-r*l,_=h*y-d*m,E=h*p-u*m,P=h*g-f*m,C=d*p-u*y,D=d*g-f*y,W=u*g-f*p,X=S*W-b*D+v*C+w*P-T*E+R*_;if(X===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let O=1/X;return t[0]=(o*W-l*D+c*C)*O,t[1]=(s*D-n*W-r*C)*O,t[2]=(y*R-p*T+g*w)*O,t[3]=(u*T-d*R-f*w)*O,t[4]=(l*P-a*W-c*E)*O,t[5]=(e*W-s*P+r*E)*O,t[6]=(p*v-m*R-g*b)*O,t[7]=(h*R-u*v+f*b)*O,t[8]=(a*D-o*P+c*_)*O,t[9]=(n*P-e*D-r*_)*O,t[10]=(m*T-y*v+g*S)*O,t[11]=(d*v-h*T-f*S)*O,t[12]=(o*E-a*C-l*_)*O,t[13]=(e*C-n*E+s*_)*O,t[14]=(y*b-m*w-p*S)*O,t[15]=(h*w-d*b+u*S)*O,this}scale(t){let e=this.elements,n=t.x,s=t.y,r=t.z;return e[0]*=n,e[4]*=s,e[8]*=r,e[1]*=n,e[5]*=s,e[9]*=r,e[2]*=n,e[6]*=s,e[10]*=r,e[3]*=n,e[7]*=s,e[11]*=r,this}getMaxScaleOnAxis(){let t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],n=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],s=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,n,s))}makeTranslation(t,e,n){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,n,0,0,0,1),this}makeRotationX(t){let e=Math.cos(t),n=Math.sin(t);return this.set(1,0,0,0,0,e,-n,0,0,n,e,0,0,0,0,1),this}makeRotationY(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,0,n,0,0,1,0,0,-n,0,e,0,0,0,0,1),this}makeRotationZ(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,0,n,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){let n=Math.cos(e),s=Math.sin(e),r=1-n,a=t.x,o=t.y,l=t.z,c=r*a,h=r*o;return this.set(c*a+n,c*o-s*l,c*l+s*o,0,c*o+s*l,h*o+n,h*l-s*a,0,c*l-s*o,h*l+s*a,r*l*l+n,0,0,0,0,1),this}makeScale(t,e,n){return this.set(t,0,0,0,0,e,0,0,0,0,n,0,0,0,0,1),this}makeShear(t,e,n,s,r,a){return this.set(1,n,r,0,t,1,a,0,e,s,1,0,0,0,0,1),this}compose(t,e,n){let s=this.elements,r=e._x,a=e._y,o=e._z,l=e._w,c=r+r,h=a+a,d=o+o,u=r*c,f=r*h,m=r*d,y=a*h,p=a*d,g=o*d,S=l*c,b=l*h,v=l*d,w=n.x,T=n.y,R=n.z;return s[0]=(1-(y+g))*w,s[1]=(f+v)*w,s[2]=(m-b)*w,s[3]=0,s[4]=(f-v)*T,s[5]=(1-(u+g))*T,s[6]=(p+S)*T,s[7]=0,s[8]=(m+b)*R,s[9]=(p-S)*R,s[10]=(1-(u+y))*R,s[11]=0,s[12]=t.x,s[13]=t.y,s[14]=t.z,s[15]=1,this}decompose(t,e,n){let s=this.elements;t.x=s[12],t.y=s[13],t.z=s[14];let r=this.determinantAffine();if(r===0)return n.set(1,1,1),e.identity(),this;let a=ts.set(s[0],s[1],s[2]).length(),o=ts.set(s[4],s[5],s[6]).length(),l=ts.set(s[8],s[9],s[10]).length();r<0&&(a=-a),bn.copy(this);let c=1/a,h=1/o,d=1/l;return bn.elements[0]*=c,bn.elements[1]*=c,bn.elements[2]*=c,bn.elements[4]*=h,bn.elements[5]*=h,bn.elements[6]*=h,bn.elements[8]*=d,bn.elements[9]*=d,bn.elements[10]*=d,e.setFromRotationMatrix(bn),n.x=a,n.y=o,n.z=l,this}makePerspective(t,e,n,s,r,a,o=wn,l=!1){let c=this.elements,h=2*r/(e-t),d=2*r/(n-s),u=(e+t)/(e-t),f=(n+s)/(n-s),m,y;if(l)m=r/(a-r),y=a*r/(a-r);else if(o===wn)m=-(a+r)/(a-r),y=-2*a*r/(a-r);else if(o===ds)m=-a/(a-r),y=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=u,c[12]=0,c[1]=0,c[5]=d,c[9]=f,c[13]=0,c[2]=0,c[6]=0,c[10]=m,c[14]=y,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(t,e,n,s,r,a,o=wn,l=!1){let c=this.elements,h=2/(e-t),d=2/(n-s),u=-(e+t)/(e-t),f=-(n+s)/(n-s),m,y;if(l)m=1/(a-r),y=a/(a-r);else if(o===wn)m=-2/(a-r),y=-(a+r)/(a-r);else if(o===ds)m=-1/(a-r),y=-r/(a-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=0,c[12]=u,c[1]=0,c[5]=d,c[9]=0,c[13]=f,c[2]=0,c[6]=0,c[10]=m,c[14]=y,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(t){let e=this.elements,n=t.elements;for(let s=0;s<16;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<16;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){let n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t[e+9]=n[9],t[e+10]=n[10],t[e+11]=n[11],t[e+12]=n[12],t[e+13]=n[13],t[e+14]=n[14],t[e+15]=n[15],t}};Ga.prototype.isMatrix4=!0;var ve=Ga,ts=new I,bn=new ve,bd=new I(0,0,0),Td=new I(1,1,1),ui=new I,Nr=new I,un=new I,$c=new ve,Qc=new zn,ei=class i{constructor(t=0,e=0,n=0,s=i.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=n,this._order=s}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,n,s=this._order){return this._x=t,this._y=e,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,n=!0){let s=t.elements,r=s[0],a=s[4],o=s[8],l=s[1],c=s[5],h=s[9],d=s[2],u=s[6],f=s[10];switch(e){case"XYZ":this._y=Math.asin(ie(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,f),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(u,c),this._z=0);break;case"YXZ":this._x=Math.asin(-ie(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,f),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-d,r),this._z=0);break;case"ZXY":this._x=Math.asin(ie(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(-d,f),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-ie(d,-1,1)),Math.abs(d)<.9999999?(this._x=Math.atan2(u,f),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(ie(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-d,r)):(this._x=0,this._y=Math.atan2(o,f));break;case"XZY":this._z=Math.asin(-ie(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(u,c),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-h,f),this._y=0);break;default:Gt("Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,n===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,n){return $c.makeRotationFromQuaternion(t),this.setFromRotationMatrix($c,e,n)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return Qc.setFromEuler(this),this.setFromQuaternion(Qc,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};ei.DEFAULT_ORDER="XYZ";var ms=class{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}},Ed=0,jc=new I,es=new zn,qn=new ve,Ur=new I,zs=new I,wd=new I,Ad=new zn,th=new I(1,0,0),eh=new I(0,1,0),nh=new I(0,0,1),ih={type:"added"},Rd={type:"removed"},ns={type:"childadded",child:null},el={type:"childremoved",child:null},Ne=class i extends Bn{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Ed++}),this.uuid=Rs(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=i.DEFAULT_UP.clone();let t=new I,e=new ei,n=new zn,s=new I(1,1,1);function r(){n.setFromEuler(e,!1)}function a(){e.setFromQuaternion(n,void 0,!1)}e._onChange(r),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new ve},normalMatrix:{value:new qt}}),this.matrix=new ve,this.matrixWorld=new ve,this.matrixAutoUpdate=i.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=i.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new ms,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return es.setFromAxisAngle(t,e),this.quaternion.multiply(es),this}rotateOnWorldAxis(t,e){return es.setFromAxisAngle(t,e),this.quaternion.premultiply(es),this}rotateX(t){return this.rotateOnAxis(th,t)}rotateY(t){return this.rotateOnAxis(eh,t)}rotateZ(t){return this.rotateOnAxis(nh,t)}translateOnAxis(t,e){return jc.copy(t).applyQuaternion(this.quaternion),this.position.add(jc.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(th,t)}translateY(t){return this.translateOnAxis(eh,t)}translateZ(t){return this.translateOnAxis(nh,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(qn.copy(this.matrixWorld).invert())}lookAt(t,e,n){t.isVector3?Ur.copy(t):Ur.set(t,e,n);let s=this.parent;this.updateWorldMatrix(!0,!1),zs.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?qn.lookAt(zs,Ur,this.up):qn.lookAt(Ur,zs,this.up),this.quaternion.setFromRotationMatrix(qn),s&&(qn.extractRotation(s.matrixWorld),es.setFromRotationMatrix(qn),this.quaternion.premultiply(es.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(Ht("Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(ih),ns.child=t,this.dispatchEvent(ns),ns.child=null):Ht("Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(Rd),el.child=t,this.dispatchEvent(el),el.child=null),this}removeFromParent(){let t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),qn.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),qn.multiply(t.parent.matrixWorld)),t.applyMatrix4(qn),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(ih),ns.child=t,this.dispatchEvent(ns),ns.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let n=0,s=this.children.length;n<s;n++){let a=this.children[n].getObjectByProperty(t,e);if(a!==void 0)return a}}getObjectsByProperty(t,e,n=[]){this[t]===e&&n.push(this);let s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].getObjectsByProperty(t,e,n);return n}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(zs,t,wd),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(zs,Ad,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);let e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}traverse(t){t(this);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverseVisible(t)}traverseAncestors(t){let e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let t=this.pivot;if(t!==null){let e=t.x,n=t.y,s=t.z,r=this.matrix.elements;r[12]+=e-r[0]*e-r[4]*n-r[8]*s,r[13]+=n-r[1]*e-r[5]*n-r[9]*s,r[14]+=s-r[2]*e-r[6]*n-r[10]*s}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].updateMatrixWorld(t)}updateWorldMatrix(t,e,n=!1){let s=this.parent;if(t===!0&&s!==null&&s.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),e===!0){let r=this.children;for(let a=0,o=r.length;a<o;a++)r[a].updateWorldMatrix(!1,!0,n)}}toJSON(t){let e=t===void 0||typeof t=="string",n={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),this.static!==!1&&(s.static=this.static),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.pivot!==null&&(s.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(s.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(s.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(o=>({...o})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(t),s.indirectTexture=this._indirectTexture.toJSON(t),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function r(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(t)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(t.geometries,this.geometry);let o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){let l=o.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){let d=l[c];r(t.shapes,d)}else r(t.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(t.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(r(t.materials,this.material[l]));s.material=o}else s.material=r(t.materials,this.material);if(this.children.length>0){s.children=[];for(let o=0;o<this.children.length;o++)s.children.push(this.children[o].toJSON(t).object)}if(this.animations.length>0){s.animations=[];for(let o=0;o<this.animations.length;o++){let l=this.animations[o];s.animations.push(r(t.animations,l))}}if(e){let o=a(t.geometries),l=a(t.materials),c=a(t.textures),h=a(t.images),d=a(t.shapes),u=a(t.skeletons),f=a(t.animations),m=a(t.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),d.length>0&&(n.shapes=d),u.length>0&&(n.skeletons=u),f.length>0&&(n.animations=f),m.length>0&&(n.nodes=m)}return n.object=s,n;function a(o){let l=[];for(let c in o){let h=o[c];delete h.metadata,l.push(h)}return l}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.pivot=t.pivot!==null?t.pivot.clone():null,this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.static=t.static,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let n=0;n<t.children.length;n++){let s=t.children[n];this.add(s.clone())}return this}};Ne.DEFAULT_UP=new I(0,1,0);Ne.DEFAULT_MATRIX_AUTO_UPDATE=!0;Ne.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var be=class extends Ne{constructor(){super(),this.isGroup=!0,this.type="Group"}},Cd={type:"move"},gs=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new be,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new be,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new I,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new I),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new be,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new I,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new I,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){let e=this._hand;if(e)for(let n of t.hand.values())this._getHandJoint(e,n)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,n){let s=null,r=null,a=null,o=this._targetRay,l=this._grip,c=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(c&&t.hand){a=!0;for(let y of t.hand.values()){let p=e.getJointPose(y,n),g=this._getHandJoint(c,y);p!==null&&(g.matrix.fromArray(p.transform.matrix),g.matrix.decompose(g.position,g.rotation,g.scale),g.matrixWorldNeedsUpdate=!0,g.jointRadius=p.radius),g.visible=p!==null}let h=c.joints["index-finger-tip"],d=c.joints["thumb-tip"],u=h.position.distanceTo(d.position),f=.02,m=.005;c.inputState.pinching&&u>f+m?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!c.inputState.pinching&&u<=f-m&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else l!==null&&t.gripSpace&&(r=e.getPose(t.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:t,target:this})));o!==null&&(s=e.getPose(t.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(o.matrix.fromArray(s.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,s.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(s.linearVelocity)):o.hasLinearVelocity=!1,s.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(s.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(Cd)))}return o!==null&&(o.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){let n=new be;n.matrixAutoUpdate=!1,n.visible=!1,t.joints[e.jointName]=n,t.add(n)}return t.joints[e.jointName]}},ru={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},di={h:0,s:0,l:0},Fr={h:0,s:0,l:0};function nl(i,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?i+(t-i)*6*e:e<1/2?t:e<2/3?i+(t-i)*6*(2/3-e):i}var Yt=class{constructor(t,e,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,n)}set(t,e,n){if(e===void 0&&n===void 0){let s=t;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(t,e,n);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=Se){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,se.colorSpaceToWorking(this,e),this}setRGB(t,e,n,s=se.workingColorSpace){return this.r=t,this.g=e,this.b=n,se.colorSpaceToWorking(this,s),this}setHSL(t,e,n,s=se.workingColorSpace){if(t=vd(t,1),e=ie(e,0,1),n=ie(n,0,1),e===0)this.r=this.g=this.b=n;else{let r=n<=.5?n*(1+e):n+e-n*e,a=2*n-r;this.r=nl(a,r,t+1/3),this.g=nl(a,r,t),this.b=nl(a,r,t-1/3)}return se.colorSpaceToWorking(this,s),this}setStyle(t,e=Se){function n(r){r!==void 0&&parseFloat(r)<1&&Gt("Color: Alpha component of "+t+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(t)){let r,a=s[1],o=s[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,e);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,e);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,e);break;default:Gt("Color: Unknown color model "+t)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(t)){let r=s[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,e);if(a===6)return this.setHex(parseInt(r,16),e);Gt("Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=Se){let n=ru[t.toLowerCase()];return n!==void 0?this.setHex(n,e):Gt("Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=$n(t.r),this.g=$n(t.g),this.b=$n(t.b),this}copyLinearToSRGB(t){return this.r=us(t.r),this.g=us(t.g),this.b=us(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=Se){return se.workingToColorSpace(Je.copy(this),t),Math.round(ie(Je.r*255,0,255))*65536+Math.round(ie(Je.g*255,0,255))*256+Math.round(ie(Je.b*255,0,255))}getHexString(t=Se){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=se.workingColorSpace){se.workingToColorSpace(Je.copy(this),e);let n=Je.r,s=Je.g,r=Je.b,a=Math.max(n,s,r),o=Math.min(n,s,r),l,c,h=(o+a)/2;if(o===a)l=0,c=0;else{let d=a-o;switch(c=h<=.5?d/(a+o):d/(2-a-o),a){case n:l=(s-r)/d+(s<r?6:0);break;case s:l=(r-n)/d+2;break;case r:l=(n-s)/d+4;break}l/=6}return t.h=l,t.s=c,t.l=h,t}getRGB(t,e=se.workingColorSpace){return se.workingToColorSpace(Je.copy(this),e),t.r=Je.r,t.g=Je.g,t.b=Je.b,t}getStyle(t=Se){se.workingToColorSpace(Je.copy(this),t);let e=Je.r,n=Je.g,s=Je.b;return t!==Se?`color(${t} ${e.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(t,e,n){return this.getHSL(di),this.setHSL(di.h+t,di.s+e,di.l+n)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,n){return this.r=t.r+(e.r-t.r)*n,this.g=t.g+(e.g-t.g)*n,this.b=t.b+(e.b-t.b)*n,this}lerpHSL(t,e){this.getHSL(di),t.getHSL(Fr);let n=Jo(di.h,Fr.h,e),s=Jo(di.s,Fr.s,e),r=Jo(di.l,Fr.l,e);return this.setHSL(n,s,r),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){let e=this.r,n=this.g,s=this.b,r=t.elements;return this.r=r[0]*e+r[3]*n+r[6]*s,this.g=r[1]*e+r[4]*n+r[7]*s,this.b=r[2]*e+r[5]*n+r[8]*s,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Je=new Yt;Yt.NAMES=ru;var Qs=class i{constructor(t,e=25e-5){this.isFogExp2=!0,this.name="",this.color=new Yt(t),this.density=e}clone(){return new i(this.color,this.density)}toJSON(){return{type:"FogExp2",name:this.name,color:this.color.getHex(),density:this.density}}};var js=class extends Ne{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new ei,this.environmentIntensity=1,this.environmentRotation=new ei,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__!="undefined"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){let e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(e.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(e.object.backgroundIntensity=this.backgroundIntensity),e.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(e.object.environmentIntensity=this.environmentIntensity),e.object.environmentRotation=this.environmentRotation.toArray(),e}},Tn=new I,Yn=new I,il=new I,Zn=new I,is=new I,ss=new I,sh=new I,sl=new I,rl=new I,al=new I,ol=new Te,ll=new Te,cl=new Te,_i=class i{constructor(t=new I,e=new I,n=new I){this.a=t,this.b=e,this.c=n}static getNormal(t,e,n,s){s.subVectors(n,e),Tn.subVectors(t,e),s.cross(Tn);let r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(t,e,n,s,r){Tn.subVectors(s,e),Yn.subVectors(n,e),il.subVectors(t,e);let a=Tn.dot(Tn),o=Tn.dot(Yn),l=Tn.dot(il),c=Yn.dot(Yn),h=Yn.dot(il),d=a*c-o*o;if(d===0)return r.set(0,0,0),null;let u=1/d,f=(c*l-o*h)*u,m=(a*h-o*l)*u;return r.set(1-f-m,m,f)}static containsPoint(t,e,n,s){return this.getBarycoord(t,e,n,s,Zn)===null?!1:Zn.x>=0&&Zn.y>=0&&Zn.x+Zn.y<=1}static getInterpolation(t,e,n,s,r,a,o,l){return this.getBarycoord(t,e,n,s,Zn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,Zn.x),l.addScaledVector(a,Zn.y),l.addScaledVector(o,Zn.z),l)}static getInterpolatedAttribute(t,e,n,s,r,a){return ol.setScalar(0),ll.setScalar(0),cl.setScalar(0),ol.fromBufferAttribute(t,e),ll.fromBufferAttribute(t,n),cl.fromBufferAttribute(t,s),a.setScalar(0),a.addScaledVector(ol,r.x),a.addScaledVector(ll,r.y),a.addScaledVector(cl,r.z),a}static isFrontFacing(t,e,n,s){return Tn.subVectors(n,e),Yn.subVectors(t,e),Tn.cross(Yn).dot(s)<0}set(t,e,n){return this.a.copy(t),this.b.copy(e),this.c.copy(n),this}setFromPointsAndIndices(t,e,n,s){return this.a.copy(t[e]),this.b.copy(t[n]),this.c.copy(t[s]),this}setFromAttributeAndIndices(t,e,n,s){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,n),this.c.fromBufferAttribute(t,s),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return Tn.subVectors(this.c,this.b),Yn.subVectors(this.a,this.b),Tn.cross(Yn).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return i.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return i.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,n,s,r){return i.getInterpolation(t,this.a,this.b,this.c,e,n,s,r)}containsPoint(t){return i.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return i.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){let n=this.a,s=this.b,r=this.c,a,o;is.subVectors(s,n),ss.subVectors(r,n),sl.subVectors(t,n);let l=is.dot(sl),c=ss.dot(sl);if(l<=0&&c<=0)return e.copy(n);rl.subVectors(t,s);let h=is.dot(rl),d=ss.dot(rl);if(h>=0&&d<=h)return e.copy(s);let u=l*d-h*c;if(u<=0&&l>=0&&h<=0)return a=l/(l-h),e.copy(n).addScaledVector(is,a);al.subVectors(t,r);let f=is.dot(al),m=ss.dot(al);if(m>=0&&f<=m)return e.copy(r);let y=f*c-l*m;if(y<=0&&c>=0&&m<=0)return o=c/(c-m),e.copy(n).addScaledVector(ss,o);let p=h*m-f*d;if(p<=0&&d-h>=0&&f-m>=0)return sh.subVectors(r,s),o=(d-h)/(d-h+(f-m)),e.copy(s).addScaledVector(sh,o);let g=1/(p+y+u);return a=y*g,o=u*g,e.copy(n).addScaledVector(is,a).addScaledVector(ss,o)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}},vi=class{constructor(t=new I(1/0,1/0,1/0),e=new I(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e+=3)this.expandByPoint(En.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,n=t.count;e<n;e++)this.expandByPoint(En.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){let n=En.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);let n=t.geometry;if(n!==void 0){let r=n.getAttribute("position");if(e===!0&&r!==void 0&&t.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)t.isMesh===!0?t.getVertexPosition(a,En):En.fromBufferAttribute(r,a),En.applyMatrix4(t.matrixWorld),this.expandByPoint(En);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),Or.copy(t.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),Or.copy(n.boundingBox)),Or.applyMatrix4(t.matrixWorld),this.union(Or)}let s=t.children;for(let r=0,a=s.length;r<a;r++)this.expandByObject(s[r],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,En),En.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,n;return t.normal.x>0?(e=t.normal.x*this.min.x,n=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,n=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,n+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,n+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,n+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,n+=t.normal.z*this.min.z),e<=-t.constant&&n>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(ks),Br.subVectors(this.max,ks),rs.subVectors(t.a,ks),as.subVectors(t.b,ks),os.subVectors(t.c,ks),fi.subVectors(as,rs),pi.subVectors(os,as),Li.subVectors(rs,os);let e=[0,-fi.z,fi.y,0,-pi.z,pi.y,0,-Li.z,Li.y,fi.z,0,-fi.x,pi.z,0,-pi.x,Li.z,0,-Li.x,-fi.y,fi.x,0,-pi.y,pi.x,0,-Li.y,Li.x,0];return!hl(e,rs,as,os,Br)||(e=[1,0,0,0,1,0,0,0,1],!hl(e,rs,as,os,Br))?!1:(zr.crossVectors(fi,pi),e=[zr.x,zr.y,zr.z],hl(e,rs,as,os,Br))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,En).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(En).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(Kn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),Kn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),Kn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),Kn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),Kn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),Kn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),Kn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),Kn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(Kn),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(t){return this.min.fromArray(t.min),this.max.fromArray(t.max),this}},Kn=[new I,new I,new I,new I,new I,new I,new I,new I],En=new I,Or=new vi,rs=new I,as=new I,os=new I,fi=new I,pi=new I,Li=new I,ks=new I,Br=new I,zr=new I,Di=new I;function hl(i,t,e,n,s){for(let r=0,a=i.length-3;r<=a;r+=3){Di.fromArray(i,r);let o=s.x*Math.abs(Di.x)+s.y*Math.abs(Di.y)+s.z*Math.abs(Di.z),l=t.dot(Di),c=e.dot(Di),h=n.dot(Di);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>o)return!1}return!0}var De=new I,kr=new ht,Pd=0,ye=class extends Bn{constructor(t,e,n=!1){if(super(),Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Pd++}),this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=n,this.usage=Al,this.updateRanges=[],this.gpuType=In,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,n){t*=this.itemSize,n*=e.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[t+s]=e.array[n+s];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,n=this.count;e<n;e++)kr.fromBufferAttribute(this,e),kr.applyMatrix3(t),this.setXY(e,kr.x,kr.y);else if(this.itemSize===3)for(let e=0,n=this.count;e<n;e++)De.fromBufferAttribute(this,e),De.applyMatrix3(t),this.setXYZ(e,De.x,De.y,De.z);return this}applyMatrix4(t){for(let e=0,n=this.count;e<n;e++)De.fromBufferAttribute(this,e),De.applyMatrix4(t),this.setXYZ(e,De.x,De.y,De.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)De.fromBufferAttribute(this,e),De.applyNormalMatrix(t),this.setXYZ(e,De.x,De.y,De.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)De.fromBufferAttribute(this,e),De.transformDirection(t),this.setXYZ(e,De.x,De.y,De.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let n=this.array[t*this.itemSize+e];return this.normalized&&(n=Bs(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=an(n,this.array)),this.array[t*this.itemSize+e]=n,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=Bs(e,this.array)),e}setX(t,e){return this.normalized&&(e=an(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=Bs(e,this.array)),e}setY(t,e){return this.normalized&&(e=an(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=Bs(e,this.array)),e}setZ(t,e){return this.normalized&&(e=an(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=Bs(e,this.array)),e}setW(t,e){return this.normalized&&(e=an(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,n){return t*=this.itemSize,this.normalized&&(e=an(e,this.array),n=an(n,this.array)),this.array[t+0]=e,this.array[t+1]=n,this}setXYZ(t,e,n,s){return t*=this.itemSize,this.normalized&&(e=an(e,this.array),n=an(n,this.array),s=an(s,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this}setXYZW(t,e,n,s,r){return t*=this.itemSize,this.normalized&&(e=an(e,this.array),n=an(n,this.array),s=an(s,this.array),r=an(r,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this.array[t+3]=r,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==Al&&(t.usage=this.usage),t}dispose(){this.dispatchEvent({type:"dispose"})}};var tr=class extends ye{constructor(t,e,n){super(new Uint16Array(t),e,n)}};var er=class extends ye{constructor(t,e,n){super(new Uint32Array(t),e,n)}};var we=class extends ye{constructor(t,e,n){super(new Float32Array(t),e,n)}},Id=new vi,Vs=new I,ul=new I,An=class{constructor(t=new I,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){let n=this.center;e!==void 0?n.copy(e):Id.setFromPoints(t).getCenter(n);let s=0;for(let r=0,a=t.length;r<a;r++)s=Math.max(s,n.distanceToSquared(t[r]));return this.radius=Math.sqrt(s),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){let e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){let n=this.center.distanceToSquared(t);return e.copy(t),n>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;Vs.subVectors(t,this.center);let e=Vs.lengthSq();if(e>this.radius*this.radius){let n=Math.sqrt(e),s=(n-this.radius)*.5;this.center.addScaledVector(Vs,s/n),this.radius+=s}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(ul.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(Vs.copy(t.center).add(ul)),this.expandByPoint(Vs.copy(t.center).sub(ul))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(t){return this.radius=t.radius,this.center.fromArray(t.center),this}},Ld=0,xn=new ve,dl=new Ne,ls=new I,dn=new vi,Hs=new vi,Be=new I,Ue=class i extends Bn{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Ld++}),this.uuid=Rs(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(_d(t)?er:tr)(t,1):this.index=t,this}setIndirect(t,e=0){return this.indirect=t,this.indirectOffset=e,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,n=0){this.groups.push({start:t,count:e,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){let e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let r=new qt().getNormalMatrix(t);n.applyNormalMatrix(r),n.needsUpdate=!0}let s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(t),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(t){return xn.makeRotationFromQuaternion(t),this.applyMatrix4(xn),this}rotateX(t){return xn.makeRotationX(t),this.applyMatrix4(xn),this}rotateY(t){return xn.makeRotationY(t),this.applyMatrix4(xn),this}rotateZ(t){return xn.makeRotationZ(t),this.applyMatrix4(xn),this}translate(t,e,n){return xn.makeTranslation(t,e,n),this.applyMatrix4(xn),this}scale(t,e,n){return xn.makeScale(t,e,n),this.applyMatrix4(xn),this}lookAt(t){return dl.lookAt(t),dl.updateMatrix(),this.applyMatrix4(dl.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(ls).negate(),this.translate(ls.x,ls.y,ls.z),this}setFromPoints(t){let e=this.getAttribute("position");if(e===void 0){let n=[];for(let s=0,r=t.length;s<r;s++){let a=t[s];n.push(a.x,a.y,a.z||0)}this.setAttribute("position",new we(n,3))}else{let n=Math.min(t.length,e.count);for(let s=0;s<n;s++){let r=t[s];e.setXYZ(s,r.x,r.y,r.z||0)}t.length>e.count&&Gt("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new vi);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){Ht("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new I(-1/0,-1/0,-1/0),new I(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let n=0,s=e.length;n<s;n++){let r=e[n];dn.setFromBufferAttribute(r),this.morphTargetsRelative?(Be.addVectors(this.boundingBox.min,dn.min),this.boundingBox.expandByPoint(Be),Be.addVectors(this.boundingBox.max,dn.max),this.boundingBox.expandByPoint(Be)):(this.boundingBox.expandByPoint(dn.min),this.boundingBox.expandByPoint(dn.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Ht('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new An);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){Ht("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new I,1/0);return}if(t){let n=this.boundingSphere.center;if(dn.setFromBufferAttribute(t),e)for(let r=0,a=e.length;r<a;r++){let o=e[r];Hs.setFromBufferAttribute(o),this.morphTargetsRelative?(Be.addVectors(dn.min,Hs.min),dn.expandByPoint(Be),Be.addVectors(dn.max,Hs.max),dn.expandByPoint(Be)):(dn.expandByPoint(Hs.min),dn.expandByPoint(Hs.max))}dn.getCenter(n);let s=0;for(let r=0,a=t.count;r<a;r++)Be.fromBufferAttribute(t,r),s=Math.max(s,n.distanceToSquared(Be));if(e)for(let r=0,a=e.length;r<a;r++){let o=e[r],l=this.morphTargetsRelative;for(let c=0,h=o.count;c<h;c++)Be.fromBufferAttribute(o,c),l&&(ls.fromBufferAttribute(t,c),Be.add(ls)),s=Math.max(s,n.distanceToSquared(Be))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&Ht('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){Ht("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let n=e.position,s=e.normal,r=e.uv,a=this.getAttribute("tangent");(a===void 0||a.count!==n.count)&&(a=new ye(new Float32Array(4*n.count),4),this.setAttribute("tangent",a));let o=[],l=[];for(let _=0;_<n.count;_++)o[_]=new I,l[_]=new I;let c=new I,h=new I,d=new I,u=new ht,f=new ht,m=new ht,y=new I,p=new I;function g(_,E,P){c.fromBufferAttribute(n,_),h.fromBufferAttribute(n,E),d.fromBufferAttribute(n,P),u.fromBufferAttribute(r,_),f.fromBufferAttribute(r,E),m.fromBufferAttribute(r,P),h.sub(c),d.sub(c),f.sub(u),m.sub(u);let C=1/(f.x*m.y-m.x*f.y);isFinite(C)&&(y.copy(h).multiplyScalar(m.y).addScaledVector(d,-f.y).multiplyScalar(C),p.copy(d).multiplyScalar(f.x).addScaledVector(h,-m.x).multiplyScalar(C),o[_].add(y),o[E].add(y),o[P].add(y),l[_].add(p),l[E].add(p),l[P].add(p))}let S=this.groups;S.length===0&&(S=[{start:0,count:t.count}]);for(let _=0,E=S.length;_<E;++_){let P=S[_],C=P.start,D=P.count;for(let W=C,X=C+D;W<X;W+=3)g(t.getX(W+0),t.getX(W+1),t.getX(W+2))}let b=new I,v=new I,w=new I,T=new I;function R(_){w.fromBufferAttribute(s,_),T.copy(w);let E=o[_];b.copy(E),b.sub(w.multiplyScalar(w.dot(E))).normalize(),v.crossVectors(T,E);let C=v.dot(l[_])<0?-1:1;a.setXYZW(_,b.x,b.y,b.z,C)}for(let _=0,E=S.length;_<E;++_){let P=S[_],C=P.start,D=P.count;for(let W=C,X=C+D;W<X;W+=3)R(t.getX(W+0)),R(t.getX(W+1)),R(t.getX(W+2))}this._transformed=!0}computeVertexNormals(){let t=this.index,e=this.getAttribute("position");if(e!==void 0){let n=this.getAttribute("normal");if(n===void 0||n.count!==e.count)n=new ye(new Float32Array(e.count*3),3),this.setAttribute("normal",n);else for(let u=0,f=n.count;u<f;u++)n.setXYZ(u,0,0,0);let s=new I,r=new I,a=new I,o=new I,l=new I,c=new I,h=new I,d=new I;if(t)for(let u=0,f=t.count;u<f;u+=3){let m=t.getX(u+0),y=t.getX(u+1),p=t.getX(u+2);s.fromBufferAttribute(e,m),r.fromBufferAttribute(e,y),a.fromBufferAttribute(e,p),h.subVectors(a,r),d.subVectors(s,r),h.cross(d),o.fromBufferAttribute(n,m),l.fromBufferAttribute(n,y),c.fromBufferAttribute(n,p),o.add(h),l.add(h),c.add(h),n.setXYZ(m,o.x,o.y,o.z),n.setXYZ(y,l.x,l.y,l.z),n.setXYZ(p,c.x,c.y,c.z)}else for(let u=0,f=e.count;u<f;u+=3)s.fromBufferAttribute(e,u+0),r.fromBufferAttribute(e,u+1),a.fromBufferAttribute(e,u+2),h.subVectors(a,r),d.subVectors(s,r),h.cross(d),n.setXYZ(u+0,h.x,h.y,h.z),n.setXYZ(u+1,h.x,h.y,h.z),n.setXYZ(u+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let t=this.attributes.normal;for(let e=0,n=t.count;e<n;e++)Be.fromBufferAttribute(t,e),Be.normalize(),t.setXYZ(e,Be.x,Be.y,Be.z)}toNonIndexed(){function t(o,l){let c=o.array,h=o.itemSize,d=o.normalized,u=new c.constructor(l.length*h),f=0,m=0;for(let y=0,p=l.length;y<p;y++){o.isInterleavedBufferAttribute?f=l[y]*o.data.stride+o.offset:f=l[y]*h;for(let g=0;g<h;g++)u[m++]=c[f++]}return new ye(u,h,d)}if(this.index===null)return Gt("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let e=new i,n=this.index.array,s=this.attributes;for(let o in s){let l=s[o],c=t(l,n);e.setAttribute(o,c)}let r=this.morphAttributes;for(let o in r){let l=[],c=r[o];for(let h=0,d=c.length;h<d;h++){let u=c[h],f=t(u,n);l.push(f)}e.morphAttributes[o]=l}e.morphTargetsRelative=this.morphTargetsRelative;let a=this.groups;for(let o=0,l=a.length;o<l;o++){let c=a[o];e.addGroup(c.start,c.count,c.materialIndex)}return e}toJSON(){let t={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(t[c]=l[c]);return t}t.data={attributes:{}};let e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});let n=this.attributes;for(let l in n){let c=n[l];t.data.attributes[l]=c.toJSON(t.data)}let s={},r=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],h=[];for(let d=0,u=c.length;d<u;d++){let f=c[d];h.push(f.toJSON(t.data))}h.length>0&&(s[l]=h,r=!0)}r&&(t.data.morphAttributes=s,t.data.morphTargetsRelative=this.morphTargetsRelative);let a=this.groups;a.length>0&&(t.data.groups=JSON.parse(JSON.stringify(a)));let o=this.boundingSphere;return o!==null&&(t.data.boundingSphere=o.toJSON()),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let e={};this.name=t.name;let n=t.index;n!==null&&this.setIndex(n.clone());let s=t.attributes;for(let c in s){let h=s[c];this.setAttribute(c,h.clone(e))}let r=t.morphAttributes;for(let c in r){let h=[],d=r[c];for(let u=0,f=d.length;u<f;u++)h.push(d[u].clone(e));this.morphAttributes[c]=h}this.morphTargetsRelative=t.morphTargetsRelative;let a=t.groups;for(let c=0,h=a.length;c<h;c++){let d=a[c];this.addGroup(d.start,d.count,d.materialIndex)}let o=t.boundingBox;o!==null&&(this.boundingBox=o.clone());let l=t.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this._transformed=t._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}};var Dd=0,ni=class extends Bn{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Dd++}),this.uuid=Rs(),this.name="",this.type="Material",this.blending=jn,this.side=Qn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=ra,this.blendDst=aa,this.blendEquation=xi,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Yt(0,0,0),this.blendAlpha=0,this.depthFunc=zi,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=wl,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Fi,this.stencilZFail=Fi,this.stencilZPass=Fi,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(let e in t){let n=t[e];if(n===void 0){Gt(`Material: parameter '${e}' has value of undefined.`);continue}let s=this[e];if(s===void 0){Gt(`Material: '${e}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector2&&n&&n.isVector2||s&&s.isEuler&&n&&n.isEuler||s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[e]=n}}toJSON(t){let e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});let n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(t).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(t).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(t).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(t).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(t).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(t).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(t).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==jn&&(n.blending=this.blending),this.side!==Qn&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==ra&&(n.blendSrc=this.blendSrc),this.blendDst!==aa&&(n.blendDst=this.blendDst),this.blendEquation!==xi&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==zi&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==wl&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Fi&&(n.stencilFail=this.stencilFail),this.stencilZFail!==Fi&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==Fi&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.allowOverride===!1&&(n.allowOverride=!1),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){let a=[];for(let o in r){let l=r[o];delete l.metadata,a.push(l)}return a}if(e){let r=s(t.textures),a=s(t.images);r.length>0&&(n.textures=r),a.length>0&&(n.images=a)}return n}fromJSON(t,e){if(t.uuid!==void 0&&(this.uuid=t.uuid),t.name!==void 0&&(this.name=t.name),t.color!==void 0&&this.color!==void 0&&this.color.setHex(t.color),t.roughness!==void 0&&(this.roughness=t.roughness),t.metalness!==void 0&&(this.metalness=t.metalness),t.sheen!==void 0&&(this.sheen=t.sheen),t.sheenColor!==void 0&&(this.sheenColor=new Yt().setHex(t.sheenColor)),t.sheenRoughness!==void 0&&(this.sheenRoughness=t.sheenRoughness),t.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(t.emissive),t.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(t.specular),t.specularIntensity!==void 0&&(this.specularIntensity=t.specularIntensity),t.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(t.specularColor),t.shininess!==void 0&&(this.shininess=t.shininess),t.clearcoat!==void 0&&(this.clearcoat=t.clearcoat),t.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=t.clearcoatRoughness),t.dispersion!==void 0&&(this.dispersion=t.dispersion),t.iridescence!==void 0&&(this.iridescence=t.iridescence),t.iridescenceIOR!==void 0&&(this.iridescenceIOR=t.iridescenceIOR),t.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=t.iridescenceThicknessRange),t.transmission!==void 0&&(this.transmission=t.transmission),t.thickness!==void 0&&(this.thickness=t.thickness),t.attenuationDistance!==void 0&&(this.attenuationDistance=t.attenuationDistance),t.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(t.attenuationColor),t.anisotropy!==void 0&&(this.anisotropy=t.anisotropy),t.anisotropyRotation!==void 0&&(this.anisotropyRotation=t.anisotropyRotation),t.fog!==void 0&&(this.fog=t.fog),t.flatShading!==void 0&&(this.flatShading=t.flatShading),t.blending!==void 0&&(this.blending=t.blending),t.combine!==void 0&&(this.combine=t.combine),t.side!==void 0&&(this.side=t.side),t.shadowSide!==void 0&&(this.shadowSide=t.shadowSide),t.opacity!==void 0&&(this.opacity=t.opacity),t.transparent!==void 0&&(this.transparent=t.transparent),t.alphaTest!==void 0&&(this.alphaTest=t.alphaTest),t.alphaHash!==void 0&&(this.alphaHash=t.alphaHash),t.depthFunc!==void 0&&(this.depthFunc=t.depthFunc),t.depthTest!==void 0&&(this.depthTest=t.depthTest),t.depthWrite!==void 0&&(this.depthWrite=t.depthWrite),t.colorWrite!==void 0&&(this.colorWrite=t.colorWrite),t.blendSrc!==void 0&&(this.blendSrc=t.blendSrc),t.blendDst!==void 0&&(this.blendDst=t.blendDst),t.blendEquation!==void 0&&(this.blendEquation=t.blendEquation),t.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=t.blendSrcAlpha),t.blendDstAlpha!==void 0&&(this.blendDstAlpha=t.blendDstAlpha),t.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=t.blendEquationAlpha),t.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(t.blendColor),t.blendAlpha!==void 0&&(this.blendAlpha=t.blendAlpha),t.stencilWriteMask!==void 0&&(this.stencilWriteMask=t.stencilWriteMask),t.stencilFunc!==void 0&&(this.stencilFunc=t.stencilFunc),t.stencilRef!==void 0&&(this.stencilRef=t.stencilRef),t.stencilFuncMask!==void 0&&(this.stencilFuncMask=t.stencilFuncMask),t.stencilFail!==void 0&&(this.stencilFail=t.stencilFail),t.stencilZFail!==void 0&&(this.stencilZFail=t.stencilZFail),t.stencilZPass!==void 0&&(this.stencilZPass=t.stencilZPass),t.stencilWrite!==void 0&&(this.stencilWrite=t.stencilWrite),t.wireframe!==void 0&&(this.wireframe=t.wireframe),t.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=t.wireframeLinewidth),t.wireframeLinecap!==void 0&&(this.wireframeLinecap=t.wireframeLinecap),t.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=t.wireframeLinejoin),t.rotation!==void 0&&(this.rotation=t.rotation),t.linewidth!==void 0&&(this.linewidth=t.linewidth),t.dashSize!==void 0&&(this.dashSize=t.dashSize),t.gapSize!==void 0&&(this.gapSize=t.gapSize),t.scale!==void 0&&(this.scale=t.scale),t.polygonOffset!==void 0&&(this.polygonOffset=t.polygonOffset),t.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=t.polygonOffsetFactor),t.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=t.polygonOffsetUnits),t.dithering!==void 0&&(this.dithering=t.dithering),t.alphaToCoverage!==void 0&&(this.alphaToCoverage=t.alphaToCoverage),t.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=t.premultipliedAlpha),t.forceSinglePass!==void 0&&(this.forceSinglePass=t.forceSinglePass),t.allowOverride!==void 0&&(this.allowOverride=t.allowOverride),t.visible!==void 0&&(this.visible=t.visible),t.toneMapped!==void 0&&(this.toneMapped=t.toneMapped),t.userData!==void 0&&(this.userData=t.userData),t.vertexColors!==void 0&&(typeof t.vertexColors=="number"?this.vertexColors=t.vertexColors>0:this.vertexColors=t.vertexColors),t.size!==void 0&&(this.size=t.size),t.sizeAttenuation!==void 0&&(this.sizeAttenuation=t.sizeAttenuation),t.map!==void 0&&(this.map=e[t.map]||null),t.matcap!==void 0&&(this.matcap=e[t.matcap]||null),t.alphaMap!==void 0&&(this.alphaMap=e[t.alphaMap]||null),t.bumpMap!==void 0&&(this.bumpMap=e[t.bumpMap]||null),t.bumpScale!==void 0&&(this.bumpScale=t.bumpScale),t.normalMap!==void 0&&(this.normalMap=e[t.normalMap]||null),t.normalMapType!==void 0&&(this.normalMapType=t.normalMapType),t.normalScale!==void 0){let n=t.normalScale;Array.isArray(n)===!1&&(n=[n,n]),this.normalScale=new ht().fromArray(n)}return t.displacementMap!==void 0&&(this.displacementMap=e[t.displacementMap]||null),t.displacementScale!==void 0&&(this.displacementScale=t.displacementScale),t.displacementBias!==void 0&&(this.displacementBias=t.displacementBias),t.roughnessMap!==void 0&&(this.roughnessMap=e[t.roughnessMap]||null),t.metalnessMap!==void 0&&(this.metalnessMap=e[t.metalnessMap]||null),t.emissiveMap!==void 0&&(this.emissiveMap=e[t.emissiveMap]||null),t.emissiveIntensity!==void 0&&(this.emissiveIntensity=t.emissiveIntensity),t.specularMap!==void 0&&(this.specularMap=e[t.specularMap]||null),t.specularIntensityMap!==void 0&&(this.specularIntensityMap=e[t.specularIntensityMap]||null),t.specularColorMap!==void 0&&(this.specularColorMap=e[t.specularColorMap]||null),t.envMap!==void 0&&(this.envMap=e[t.envMap]||null),t.envMapRotation!==void 0&&this.envMapRotation.fromArray(t.envMapRotation),t.envMapIntensity!==void 0&&(this.envMapIntensity=t.envMapIntensity),t.reflectivity!==void 0&&(this.reflectivity=t.reflectivity),t.refractionRatio!==void 0&&(this.refractionRatio=t.refractionRatio),t.lightMap!==void 0&&(this.lightMap=e[t.lightMap]||null),t.lightMapIntensity!==void 0&&(this.lightMapIntensity=t.lightMapIntensity),t.aoMap!==void 0&&(this.aoMap=e[t.aoMap]||null),t.aoMapIntensity!==void 0&&(this.aoMapIntensity=t.aoMapIntensity),t.gradientMap!==void 0&&(this.gradientMap=e[t.gradientMap]||null),t.clearcoatMap!==void 0&&(this.clearcoatMap=e[t.clearcoatMap]||null),t.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=e[t.clearcoatRoughnessMap]||null),t.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=e[t.clearcoatNormalMap]||null),t.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new ht().fromArray(t.clearcoatNormalScale)),t.iridescenceMap!==void 0&&(this.iridescenceMap=e[t.iridescenceMap]||null),t.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=e[t.iridescenceThicknessMap]||null),t.transmissionMap!==void 0&&(this.transmissionMap=e[t.transmissionMap]||null),t.thicknessMap!==void 0&&(this.thicknessMap=e[t.thicknessMap]||null),t.anisotropyMap!==void 0&&(this.anisotropyMap=e[t.anisotropyMap]||null),t.sheenColorMap!==void 0&&(this.sheenColorMap=e[t.sheenColorMap]||null),t.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=e[t.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;let e=t.clippingPlanes,n=null;if(e!==null){let s=e.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=e[r].clone()}return this.clippingPlanes=n,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.allowOverride=t.allowOverride,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}};var Jn=new I,fl=new I,Vr=new I,mi=new I,pl=new I,Hr=new I,ml=new I,_s=class{constructor(t=new I,e=new I(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,Jn)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);let n=e.dot(this.direction);return n<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){let e=Jn.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(Jn.copy(this.origin).addScaledVector(this.direction,e),Jn.distanceToSquared(t))}distanceSqToSegment(t,e,n,s){fl.copy(t).add(e).multiplyScalar(.5),Vr.copy(e).sub(t).normalize(),mi.copy(this.origin).sub(fl);let r=t.distanceTo(e)*.5,a=-this.direction.dot(Vr),o=mi.dot(this.direction),l=-mi.dot(Vr),c=mi.lengthSq(),h=Math.abs(1-a*a),d,u,f,m;if(h>0)if(d=a*l-o,u=a*o-l,m=r*h,d>=0)if(u>=-m)if(u<=m){let y=1/h;d*=y,u*=y,f=d*(d+a*u+2*o)+u*(a*d+u+2*l)+c}else u=r,d=Math.max(0,-(a*u+o)),f=-d*d+u*(u+2*l)+c;else u=-r,d=Math.max(0,-(a*u+o)),f=-d*d+u*(u+2*l)+c;else u<=-m?(d=Math.max(0,-(-a*r+o)),u=d>0?-r:Math.min(Math.max(-r,-l),r),f=-d*d+u*(u+2*l)+c):u<=m?(d=0,u=Math.min(Math.max(-r,-l),r),f=u*(u+2*l)+c):(d=Math.max(0,-(a*r+o)),u=d>0?r:Math.min(Math.max(-r,-l),r),f=-d*d+u*(u+2*l)+c);else u=a>0?-r:r,d=Math.max(0,-(a*u+o)),f=-d*d+u*(u+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,d),s&&s.copy(fl).addScaledVector(Vr,u),f}intersectSphere(t,e){Jn.subVectors(t.center,this.origin);let n=Jn.dot(this.direction),s=Jn.dot(Jn)-n*n,r=t.radius*t.radius;if(s>r)return null;let a=Math.sqrt(r-s),o=n-a,l=n+a;return l<0?null:o<0?this.at(l,e):this.at(o,e)}intersectsSphere(t){return t.radius<0?!1:this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){let e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(t.normal)+t.constant)/e;return n>=0?n:null}intersectPlane(t,e){let n=this.distanceToPlane(t);return n===null?null:this.at(n,e)}intersectsPlane(t){let e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let n,s,r,a,o,l,c=1/this.direction.x,h=1/this.direction.y,d=1/this.direction.z,u=this.origin;return c>=0?(n=(t.min.x-u.x)*c,s=(t.max.x-u.x)*c):(n=(t.max.x-u.x)*c,s=(t.min.x-u.x)*c),h>=0?(r=(t.min.y-u.y)*h,a=(t.max.y-u.y)*h):(r=(t.max.y-u.y)*h,a=(t.min.y-u.y)*h),n>a||r>s||((r>n||isNaN(n))&&(n=r),(a<s||isNaN(s))&&(s=a),d>=0?(o=(t.min.z-u.z)*d,l=(t.max.z-u.z)*d):(o=(t.max.z-u.z)*d,l=(t.min.z-u.z)*d),n>l||o>s)||((o>n||n!==n)&&(n=o),(l<s||s!==s)&&(s=l),s<0)?null:this.at(n>=0?n:s,e)}intersectsBox(t){return this.intersectBox(t,Jn)!==null}intersectTriangle(t,e,n,s,r){pl.subVectors(e,t),Hr.subVectors(n,t),ml.crossVectors(pl,Hr);let a=this.direction.dot(ml),o;if(a>0){if(s)return null;o=1}else if(a<0)o=-1,a=-a;else return null;mi.subVectors(this.origin,t);let l=o*this.direction.dot(Hr.crossVectors(mi,Hr));if(l<0)return null;let c=o*this.direction.dot(pl.cross(mi));if(c<0||l+c>a)return null;let h=-o*mi.dot(ml);return h<0?null:this.at(h/a,r)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},ii=class extends ni{constructor(t){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Yt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new ei,this.combine=Gl,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}},rh=new ve,Ni=new _s,Gr=new An,ah=new I,Wr=new I,Xr=new I,qr=new I,gl=new I,Yr=new I,oh=new I,Zr=new I,Tt=class extends Ne{constructor(t=new Ue,e=new ii){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){let e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){let s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){let o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(t,e){let n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,a=n.morphTargetsRelative;e.fromBufferAttribute(s,t);let o=this.morphTargetInfluences;if(r&&o){Yr.set(0,0,0);for(let l=0,c=r.length;l<c;l++){let h=o[l],d=r[l];h!==0&&(gl.fromBufferAttribute(d,t),a?Yr.addScaledVector(gl,h):Yr.addScaledVector(gl.sub(e),h))}e.add(Yr)}return e}raycast(t,e){let n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),Gr.copy(n.boundingSphere),Gr.applyMatrix4(r),Ni.copy(t.ray).recast(t.near),!(Gr.containsPoint(Ni.origin)===!1&&(Ni.intersectSphere(Gr,ah)===null||Ni.origin.distanceToSquared(ah)>(t.far-t.near)**2))&&(rh.copy(r).invert(),Ni.copy(t.ray).applyMatrix4(rh),!(n.boundingBox!==null&&Ni.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(t,e,Ni)))}_computeIntersections(t,e,n){let s,r=this.geometry,a=this.material,o=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,d=r.attributes.normal,u=r.groups,f=r.drawRange;if(o!==null)if(Array.isArray(a))for(let m=0,y=u.length;m<y;m++){let p=u[m],g=a[p.materialIndex],S=Math.max(p.start,f.start),b=Math.min(o.count,Math.min(p.start+p.count,f.start+f.count));for(let v=S,w=b;v<w;v+=3){let T=o.getX(v),R=o.getX(v+1),_=o.getX(v+2);s=Kr(this,g,t,n,c,h,d,T,R,_),s&&(s.faceIndex=Math.floor(v/3),s.face.materialIndex=p.materialIndex,e.push(s))}}else{let m=Math.max(0,f.start),y=Math.min(o.count,f.start+f.count);for(let p=m,g=y;p<g;p+=3){let S=o.getX(p),b=o.getX(p+1),v=o.getX(p+2);s=Kr(this,a,t,n,c,h,d,S,b,v),s&&(s.faceIndex=Math.floor(p/3),e.push(s))}}else if(l!==void 0)if(Array.isArray(a))for(let m=0,y=u.length;m<y;m++){let p=u[m],g=a[p.materialIndex],S=Math.max(p.start,f.start),b=Math.min(l.count,Math.min(p.start+p.count,f.start+f.count));for(let v=S,w=b;v<w;v+=3){let T=v,R=v+1,_=v+2;s=Kr(this,g,t,n,c,h,d,T,R,_),s&&(s.faceIndex=Math.floor(v/3),s.face.materialIndex=p.materialIndex,e.push(s))}}else{let m=Math.max(0,f.start),y=Math.min(l.count,f.start+f.count);for(let p=m,g=y;p<g;p+=3){let S=p,b=p+1,v=p+2;s=Kr(this,a,t,n,c,h,d,S,b,v),s&&(s.faceIndex=Math.floor(p/3),e.push(s))}}}};function Nd(i,t,e,n,s,r,a,o){let l;if(t.side===rn?l=n.intersectTriangle(a,r,s,!0,o):l=n.intersectTriangle(s,r,a,t.side===Qn,o),l===null)return null;Zr.copy(o),Zr.applyMatrix4(i.matrixWorld);let c=e.ray.origin.distanceTo(Zr);return c<e.near||c>e.far?null:{distance:c,point:Zr.clone(),object:i}}function Kr(i,t,e,n,s,r,a,o,l,c){i.getVertexPosition(o,Wr),i.getVertexPosition(l,Xr),i.getVertexPosition(c,qr);let h=Nd(i,t,e,n,Wr,Xr,qr,oh);if(h){let d=new I;_i.getBarycoord(oh,Wr,Xr,qr,d),s&&(h.uv=_i.getInterpolatedAttribute(s,o,l,c,d,new ht)),r&&(h.uv1=_i.getInterpolatedAttribute(r,o,l,c,d,new ht)),a&&(h.normal=_i.getInterpolatedAttribute(a,o,l,c,d,new I),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));let u={a:o,b:l,c,normal:new I,materialIndex:0};_i.getNormal(Wr,Xr,qr,u.normal),h.face=u,h.barycoord=d}return h}var va=class extends nn{constructor(t=null,e=1,n=1,s,r,a,o,l,c=ke,h=ke,d,u){super(null,a,o,l,c,h,s,r,d,u),this.isDataTexture=!0,this.image={data:t,width:e,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var _l=new I,Ud=new I,Fd=new qt,vn=class{constructor(t=new I(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,n,s){return this.normal.set(t,e,n),this.constant=s,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,n){let s=_l.subVectors(n,e).cross(Ud.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(s,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){let t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e,n=!0){let s=t.delta(_l),r=this.normal.dot(s);if(r===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;let a=-(t.start.dot(this.normal)+this.constant)/r;return n===!0&&(a<0||a>1)?null:e.copy(t.start).addScaledVector(s,a)}intersectsLine(t){let e=this.distanceToPoint(t.start),n=this.distanceToPoint(t.end);return e<0&&n>0||n<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){let n=e||Fd.getNormalMatrix(t),s=this.coplanarPoint(_l).applyMatrix4(t),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}},Ui=new An,Od=new ht(.5,.5),Jr=new I,xs=class{constructor(t=new vn,e=new vn,n=new vn,s=new vn,r=new vn,a=new vn){this.planes=[t,e,n,s,r,a]}set(t,e,n,s,r,a){let o=this.planes;return o[0].copy(t),o[1].copy(e),o[2].copy(n),o[3].copy(s),o[4].copy(r),o[5].copy(a),this}copy(t){let e=this.planes;for(let n=0;n<6;n++)e[n].copy(t.planes[n]);return this}setFromProjectionMatrix(t,e=wn,n=!1){let s=this.planes,r=t.elements,a=r[0],o=r[1],l=r[2],c=r[3],h=r[4],d=r[5],u=r[6],f=r[7],m=r[8],y=r[9],p=r[10],g=r[11],S=r[12],b=r[13],v=r[14],w=r[15];if(s[0].setComponents(c-a,f-h,g-m,w-S).normalize(),s[1].setComponents(c+a,f+h,g+m,w+S).normalize(),s[2].setComponents(c+o,f+d,g+y,w+b).normalize(),s[3].setComponents(c-o,f-d,g-y,w-b).normalize(),n)s[4].setComponents(l,u,p,v).normalize(),s[5].setComponents(c-l,f-u,g-p,w-v).normalize();else if(s[4].setComponents(c-l,f-u,g-p,w-v).normalize(),e===wn)s[5].setComponents(c+l,f+u,g+p,w+v).normalize();else if(e===ds)s[5].setComponents(l,u,p,v).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),Ui.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{let e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),Ui.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(Ui)}intersectsSprite(t){Ui.center.set(0,0,0);let e=Od.distanceTo(t.center);return Ui.radius=.7071067811865476+e,Ui.applyMatrix4(t.matrixWorld),this.intersectsSphere(Ui)}intersectsSphere(t){let e=this.planes,n=t.center,s=-t.radius;for(let r=0;r<6;r++)if(e[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(t){let e=this.planes;for(let n=0;n<6;n++){let s=e[n];if(Jr.x=s.normal.x>0?t.max.x:t.min.x,Jr.y=s.normal.y>0?t.max.y:t.min.y,Jr.z=s.normal.z>0?t.max.z:t.min.z,s.distanceToPoint(Jr)<0)return!1}return!0}containsPoint(t){let e=this.planes;for(let n=0;n<6;n++)if(e[n].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};var ya=class extends ni{constructor(t){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new Yt(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.size=t.size,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}},lh=new ve,Rl=new _s,$r=new An,Qr=new I,nr=class extends Ne{constructor(t=new Ue,e=new ya){super(),this.isPoints=!0,this.type="Points",this.geometry=t,this.material=e,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}raycast(t,e){let n=this.geometry,s=this.matrixWorld,r=t.params.Points.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),$r.copy(n.boundingSphere),$r.applyMatrix4(s),$r.radius+=r,t.ray.intersectsSphere($r)===!1)return;lh.copy(s).invert(),Rl.copy(t.ray).applyMatrix4(lh);let o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=n.index,d=n.attributes.position;if(c!==null){let u=Math.max(0,a.start),f=Math.min(c.count,a.start+a.count);for(let m=u,y=f;m<y;m++){let p=c.getX(m);Qr.fromBufferAttribute(d,p),ch(Qr,p,l,s,t,e,this)}}else{let u=Math.max(0,a.start),f=Math.min(d.count,a.start+a.count);for(let m=u,y=f;m<y;m++)Qr.fromBufferAttribute(d,m),ch(Qr,m,l,s,t,e,this)}}updateMorphTargets(){let e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){let s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){let o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}};function ch(i,t,e,n,s,r,a){let o=Rl.distanceSqToPoint(i);if(o<e){let l=new I;Rl.closestPointToPoint(i,l),l.applyMatrix4(n);let c=s.ray.origin.distanceTo(l);if(c<s.near||c>s.far)return;r.push({distance:c,distanceToRay:Math.sqrt(o),point:l,index:t,face:null,faceIndex:null,barycoord:null,object:a})}}var ir=class extends nn{constructor(t=[],e=Ti,n,s,r,a,o,l,c,h){super(t,e,n,s,r,a,o,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}},yn=class extends nn{constructor(t,e,n,s,r,a,o,l,c){super(t,e,n,s,r,a,o,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}};var si=class extends nn{constructor(t,e,n=Pn,s,r,a,o=ke,l=ke,c,h=On,d=1){if(h!==On&&h!==wi)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let u={width:t,height:e,depth:d};super(u,s,r,a,o,l,h,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.source=new ps(Object.assign({},t.image)),this.compareFunction=t.compareFunction,this}toJSON(t){let e=super.toJSON(t);return this.compareFunction!==null&&(e.compareFunction=this.compareFunction),e}},Ma=class extends si{constructor(t,e=Pn,n=Ti,s,r,a=ke,o=ke,l,c=On){let h={width:t,height:t,depth:1},d=[h,h,h,h,h,h];super(t,t,e,n,s,r,a,o,l,c),this.image=d,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(t){this.image=t}},sr=class extends nn{constructor(t=null){super(),this.sourceTexture=t,this.isExternalTexture=!0}copy(t){return super.copy(t),this.sourceTexture=t.sourceTexture,this}},vs=class i extends Ue{constructor(t=1,e=1,n=1,s=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:n,widthSegments:s,heightSegments:r,depthSegments:a};let o=this;s=Math.floor(s),r=Math.floor(r),a=Math.floor(a);let l=[],c=[],h=[],d=[],u=0,f=0;m("z","y","x",-1,-1,n,e,t,a,r,0),m("z","y","x",1,-1,n,e,-t,a,r,1),m("x","z","y",1,1,t,n,e,s,a,2),m("x","z","y",1,-1,t,n,-e,s,a,3),m("x","y","z",1,-1,t,e,n,s,r,4),m("x","y","z",-1,-1,t,e,-n,s,r,5),this.setIndex(l),this.setAttribute("position",new we(c,3)),this.setAttribute("normal",new we(h,3)),this.setAttribute("uv",new we(d,2));function m(y,p,g,S,b,v,w,T,R,_,E){let P=v/R,C=w/_,D=v/2,W=w/2,X=T/2,O=R+1,H=_+1,V=0,K=0,et=new I;for(let ot=0;ot<H;ot++){let ct=ot*C-W;for(let it=0;it<O;it++){let zt=it*P-D;et[y]=zt*S,et[p]=ct*b,et[g]=X,c.push(et.x,et.y,et.z),et[y]=0,et[p]=0,et[g]=T>0?1:-1,h.push(et.x,et.y,et.z),d.push(it/R),d.push(1-ot/_),V+=1}}for(let ot=0;ot<_;ot++)for(let ct=0;ct<R;ct++){let it=u+ct+O*ot,zt=u+ct+O*(ot+1),$t=u+(ct+1)+O*(ot+1),Zt=u+(ct+1)+O*ot;l.push(it,zt,Zt),l.push(zt,$t,Zt),K+=6}o.addGroup(f,K,E),f+=K,u+=V}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}};var Ve=class i extends Ue{constructor(t=1,e=1,n=1,s=32,r=1,a=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:e,height:n,radialSegments:s,heightSegments:r,openEnded:a,thetaStart:o,thetaLength:l};let c=this;s=Math.floor(s),r=Math.floor(r);let h=[],d=[],u=[],f=[],m=0,y=[],p=n/2,g=0;S(),a===!1&&(t>0&&b(!0),e>0&&b(!1)),this.setIndex(h),this.setAttribute("position",new we(d,3)),this.setAttribute("normal",new we(u,3)),this.setAttribute("uv",new we(f,2));function S(){let v=new I,w=new I,T=0,R=(e-t)/n;for(let _=0;_<=r;_++){let E=[],P=_/r,C=P*(e-t)+t;for(let D=0;D<=s;D++){let W=D/s,X=W*l+o,O=Math.sin(X),H=Math.cos(X);w.x=C*O,w.y=-P*n+p,w.z=C*H,d.push(w.x,w.y,w.z),v.set(O,R,H).normalize(),u.push(v.x,v.y,v.z),f.push(W,1-P),E.push(m++)}y.push(E)}for(let _=0;_<s;_++)for(let E=0;E<r;E++){let P=y[E][_],C=y[E+1][_],D=y[E+1][_+1],W=y[E][_+1];(t>0||E!==0)&&(h.push(P,C,W),T+=3),(e>0||E!==r-1)&&(h.push(C,D,W),T+=3)}c.addGroup(g,T,0),g+=T}function b(v){let w=m,T=new ht,R=new I,_=0,E=v===!0?t:e,P=v===!0?1:-1;for(let D=1;D<=s;D++)d.push(0,p*P,0),u.push(0,P,0),f.push(.5,.5),m++;let C=m;for(let D=0;D<=s;D++){let X=D/s*l+o,O=Math.cos(X),H=Math.sin(X);R.x=E*H,R.y=p*P,R.z=E*O,d.push(R.x,R.y,R.z),u.push(0,P,0),T.x=O*.5+.5,T.y=H*.5*P+.5,f.push(T.x,T.y),m++}for(let D=0;D<s;D++){let W=w+D,X=C+D;v===!0?h.push(X,X+1,W):h.push(X+1,X,W),_+=3}c.addGroup(g,_,v===!0?1:2),g+=_}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}},rr=class i extends Ve{constructor(t=1,e=1,n=32,s=1,r=!1,a=0,o=Math.PI*2){super(0,t,e,n,s,r,a,o),this.type="ConeGeometry",this.parameters={radius:t,height:e,radialSegments:n,heightSegments:s,openEnded:r,thetaStart:a,thetaLength:o}}static fromJSON(t){return new i(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}};var pn=class{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){Gt("Curve: .getPoint() not implemented.")}getPointAt(t,e){let n=this.getUtoTmapping(t);return this.getPoint(n,e)}getPoints(t=5){let e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return e}getSpacedPoints(t=5){let e=[];for(let n=0;n<=t;n++)e.push(this.getPointAt(n/t));return e}getLength(){let t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let e=[],n,s=this.getPoint(0),r=0;e.push(0);for(let a=1;a<=t;a++)n=this.getPoint(a/t),r+=n.distanceTo(s),e.push(r),s=n;return this.cacheArcLengths=e,e}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,e=null){let n=this.getLengths(),s=0,r=n.length,a;e?a=e:a=t*n[r-1];let o=0,l=r-1,c;for(;o<=l;)if(s=Math.floor(o+(l-o)/2),c=n[s]-a,c<0)o=s+1;else if(c>0)l=s-1;else{l=s;break}if(s=l,n[s]===a)return s/(r-1);let h=n[s],u=n[s+1]-h,f=(a-h)/u;return(s+f)/(r-1)}getTangent(t,e){let s=t-1e-4,r=t+1e-4;s<0&&(s=0),r>1&&(r=1);let a=this.getPoint(s),o=this.getPoint(r),l=e||(a.isVector2?new ht:new I);return l.copy(o).sub(a).normalize(),l}getTangentAt(t,e){let n=this.getUtoTmapping(t);return this.getTangent(n,e)}computeFrenetFrames(t,e=!1){let n=new I,s=[],r=[],a=[],o=new I,l=new ve;for(let f=0;f<=t;f++){let m=f/t;s[f]=this.getTangentAt(m,new I)}r[0]=new I,a[0]=new I;let c=Number.MAX_VALUE,h=Math.abs(s[0].x),d=Math.abs(s[0].y),u=Math.abs(s[0].z);h<=c&&(c=h,n.set(1,0,0)),d<=c&&(c=d,n.set(0,1,0)),u<=c&&n.set(0,0,1),o.crossVectors(s[0],n).normalize(),r[0].crossVectors(s[0],o),a[0].crossVectors(s[0],r[0]);for(let f=1;f<=t;f++){if(r[f]=r[f-1].clone(),a[f]=a[f-1].clone(),o.crossVectors(s[f-1],s[f]),o.length()>Number.EPSILON){o.normalize();let m=Math.acos(ie(s[f-1].dot(s[f]),-1,1));r[f].applyMatrix4(l.makeRotationAxis(o,m))}a[f].crossVectors(s[f],r[f])}if(e===!0){let f=Math.acos(ie(r[0].dot(r[t]),-1,1));f/=t,s[0].dot(o.crossVectors(r[0],r[t]))>0&&(f=-f);for(let m=1;m<=t;m++)r[m].applyMatrix4(l.makeRotationAxis(s[m],f*m)),a[m].crossVectors(s[m],r[m])}return{tangents:s,normals:r,binormals:a}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}toJSON(){let t={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}},ys=class extends pn{constructor(t=0,e=0,n=1,s=1,r=0,a=Math.PI*2,o=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=t,this.aY=e,this.xRadius=n,this.yRadius=s,this.aStartAngle=r,this.aEndAngle=a,this.aClockwise=o,this.aRotation=l}getPoint(t,e=new ht){let n=e,s=Math.PI*2,r=this.aEndAngle-this.aStartAngle,a=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=s;for(;r>s;)r-=s;r<Number.EPSILON&&(a?r=0:r=s),this.aClockwise===!0&&!a&&(r===s?r=-s:r=r-s);let o=this.aStartAngle+t*r,l=this.aX+this.xRadius*Math.cos(o),c=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){let h=Math.cos(this.aRotation),d=Math.sin(this.aRotation),u=l-this.aX,f=c-this.aY;l=u*h-f*d+this.aX,c=u*d+f*h+this.aY}return n.set(l,c)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){let t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}},Sa=class extends ys{constructor(t,e,n,s,r,a){super(t,e,n,n,s,r,a),this.isArcCurve=!0,this.type="ArcCurve"}};function ac(){let i=0,t=0,e=0,n=0;function s(r,a,o,l){i=r,t=o,e=-3*r+3*a-2*o-l,n=2*r-2*a+o+l}return{initCatmullRom:function(r,a,o,l,c){s(a,o,c*(o-r),c*(l-a))},initNonuniformCatmullRom:function(r,a,o,l,c,h,d){let u=(a-r)/c-(o-r)/(c+h)+(o-a)/h,f=(o-a)/h-(l-a)/(h+d)+(l-o)/d;u*=h,f*=h,s(a,o,u,f)},calc:function(r){let a=r*r,o=a*r;return i+t*r+e*a+n*o}}}var hh=new I,uh=new I,xl=new ac,vl=new ac,yl=new ac,ba=class extends pn{constructor(t=[],e=!1,n="centripetal",s=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=e,this.curveType=n,this.tension=s}getPoint(t,e=new I){let n=e,s=this.points,r=s.length,a=(r-(this.closed?0:1))*t,o=Math.floor(a),l=a-o;this.closed?o+=o>0?0:(Math.floor(Math.abs(o)/r)+1)*r:l===0&&o===r-1&&(o=r-2,l=1);let c,h;this.closed||o>0?c=s[(o-1)%r]:(uh.subVectors(s[0],s[1]).add(s[0]),c=uh);let d=s[o%r],u=s[(o+1)%r];if(this.closed||o+2<r?h=s[(o+2)%r]:(hh.subVectors(s[r-1],s[r-2]).add(s[r-1]),h=hh),this.curveType==="centripetal"||this.curveType==="chordal"){let f=this.curveType==="chordal"?.5:.25,m=Math.pow(c.distanceToSquared(d),f),y=Math.pow(d.distanceToSquared(u),f),p=Math.pow(u.distanceToSquared(h),f);y<1e-4&&(y=1),m<1e-4&&(m=y),p<1e-4&&(p=y),xl.initNonuniformCatmullRom(c.x,d.x,u.x,h.x,m,y,p),vl.initNonuniformCatmullRom(c.y,d.y,u.y,h.y,m,y,p),yl.initNonuniformCatmullRom(c.z,d.z,u.z,h.z,m,y,p)}else this.curveType==="catmullrom"&&(xl.initCatmullRom(c.x,d.x,u.x,h.x,this.tension),vl.initCatmullRom(c.y,d.y,u.y,h.y,this.tension),yl.initCatmullRom(c.z,d.z,u.z,h.z,this.tension));return n.set(xl.calc(l),vl.calc(l),yl.calc(l)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(s.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){let t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){let s=this.points[e];t.points.push(s.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(new I().fromArray(s))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}};function dh(i,t,e,n,s){let r=(n-t)*.5,a=(s-e)*.5,o=i*i,l=i*o;return(2*e-2*n+r+a)*l+(-3*e+3*n-2*r-a)*o+r*i+e}function Bd(i,t){let e=1-i;return e*e*t}function zd(i,t){return 2*(1-i)*i*t}function kd(i,t){return i*i*t}function Ws(i,t,e,n){return Bd(i,t)+zd(i,e)+kd(i,n)}function Vd(i,t){let e=1-i;return e*e*e*t}function Hd(i,t){let e=1-i;return 3*e*e*i*t}function Gd(i,t){return 3*(1-i)*i*i*t}function Wd(i,t){return i*i*i*t}function Xs(i,t,e,n,s){return Vd(i,t)+Hd(i,e)+Gd(i,n)+Wd(i,s)}var ar=class extends pn{constructor(t=new ht,e=new ht,n=new ht,s=new ht){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=t,this.v1=e,this.v2=n,this.v3=s}getPoint(t,e=new ht){let n=e,s=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(Xs(t,s.x,r.x,a.x,o.x),Xs(t,s.y,r.y,a.y,o.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},Ta=class extends pn{constructor(t=new I,e=new I,n=new I,s=new I){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=t,this.v1=e,this.v2=n,this.v3=s}getPoint(t,e=new I){let n=e,s=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(Xs(t,s.x,r.x,a.x,o.x),Xs(t,s.y,r.y,a.y,o.y),Xs(t,s.z,r.z,a.z,o.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},or=class extends pn{constructor(t=new ht,e=new ht){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=t,this.v2=e}getPoint(t,e=new ht){let n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new ht){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},Ea=class extends pn{constructor(t=new I,e=new I){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=t,this.v2=e}getPoint(t,e=new I){let n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new I){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},lr=class extends pn{constructor(t=new ht,e=new ht,n=new ht){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new ht){let n=e,s=this.v0,r=this.v1,a=this.v2;return n.set(Ws(t,s.x,r.x,a.x),Ws(t,s.y,r.y,a.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},wa=class extends pn{constructor(t=new I,e=new I,n=new I){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new I){let n=e,s=this.v0,r=this.v1,a=this.v2;return n.set(Ws(t,s.x,r.x,a.x),Ws(t,s.y,r.y,a.y),Ws(t,s.z,r.z,a.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},cr=class extends pn{constructor(t=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=t}getPoint(t,e=new ht){let n=e,s=this.points,r=(s.length-1)*t,a=Math.floor(r),o=r-a,l=s[a===0?a:a-1],c=s[a],h=s[a>s.length-2?s.length-1:a+1],d=s[a>s.length-3?s.length-1:a+2];return n.set(dh(o,l.x,c.x,h.x,d.x),dh(o,l.y,c.y,h.y,d.y)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(s.clone())}return this}toJSON(){let t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){let s=this.points[e];t.points.push(s.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(new ht().fromArray(s))}return this}},Cl=Object.freeze({__proto__:null,ArcCurve:Sa,CatmullRomCurve3:ba,CubicBezierCurve:ar,CubicBezierCurve3:Ta,EllipseCurve:ys,LineCurve:or,LineCurve3:Ea,QuadraticBezierCurve:lr,QuadraticBezierCurve3:wa,SplineCurve:cr}),Aa=class extends pn{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(t){this.curves.push(t)}closePath(){let t=this.curves[0].getPoint(0),e=this.curves[this.curves.length-1].getPoint(1);if(!t.equals(e)){let n=t.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new Cl[n](e,t))}return this}getPoint(t,e){let n=t*this.getLength(),s=this.getCurveLengths(),r=0;for(;r<s.length;){if(s[r]>=n){let a=s[r]-n,o=this.curves[r],l=o.getLength(),c=l===0?0:1-a/l;return o.getPointAt(c,e)}r++}return null}getLength(){let t=this.getCurveLengths();return t[t.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;let t=[],e=0;for(let n=0,s=this.curves.length;n<s;n++)e+=this.curves[n].getLength(),t.push(e);return this.cacheLengths=t,t}getSpacedPoints(t=40){let e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return this.autoClose&&e.push(e[0]),e}getPoints(t=12){let e=[],n;for(let s=0,r=this.curves;s<r.length;s++){let a=r[s],o=a.isEllipseCurve?t*2:a.isLineCurve||a.isLineCurve3?1:a.isSplineCurve?t*a.points.length:t,l=a.getPoints(o);for(let c=0;c<l.length;c++){let h=l[c];n&&n.equals(h)||(e.push(h),n=h)}}return this.autoClose&&e.length>1&&!e[e.length-1].equals(e[0])&&e.push(e[0]),e}copy(t){super.copy(t),this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){let s=t.curves[e];this.curves.push(s.clone())}return this.autoClose=t.autoClose,this}toJSON(){let t=super.toJSON();t.autoClose=this.autoClose,t.curves=[];for(let e=0,n=this.curves.length;e<n;e++){let s=this.curves[e];t.curves.push(s.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.autoClose=t.autoClose,this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){let s=t.curves[e];this.curves.push(new Cl[s.type]().fromJSON(s))}return this}},yi=class extends Aa{constructor(t){super(),this.type="Path",this.currentPoint=new ht,t&&this.setFromPoints(t)}setFromPoints(t){this.moveTo(t[0].x,t[0].y);for(let e=1,n=t.length;e<n;e++)this.lineTo(t[e].x,t[e].y);return this}moveTo(t,e){return this.currentPoint.set(t,e),this}lineTo(t,e){let n=new or(this.currentPoint.clone(),new ht(t,e));return this.curves.push(n),this.currentPoint.set(t,e),this}quadraticCurveTo(t,e,n,s){let r=new lr(this.currentPoint.clone(),new ht(t,e),new ht(n,s));return this.curves.push(r),this.currentPoint.set(n,s),this}bezierCurveTo(t,e,n,s,r,a){let o=new ar(this.currentPoint.clone(),new ht(t,e),new ht(n,s),new ht(r,a));return this.curves.push(o),this.currentPoint.set(r,a),this}splineThru(t){let e=[this.currentPoint.clone()].concat(t),n=new cr(e);return this.curves.push(n),this.currentPoint.copy(t[t.length-1]),this}arc(t,e,n,s,r,a){let o=this.currentPoint.x,l=this.currentPoint.y;return this.absarc(t+o,e+l,n,s,r,a),this}absarc(t,e,n,s,r,a){return this.absellipse(t,e,n,n,s,r,a),this}ellipse(t,e,n,s,r,a,o,l){let c=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(t+c,e+h,n,s,r,a,o,l),this}absellipse(t,e,n,s,r,a,o,l){let c=new ys(t,e,n,s,r,a,o,l);if(this.curves.length>0){let d=c.getPoint(0);d.equals(this.currentPoint)||this.lineTo(d.x,d.y)}this.curves.push(c);let h=c.getPoint(1);return this.currentPoint.copy(h),this}copy(t){return super.copy(t),this.currentPoint.copy(t.currentPoint),this}toJSON(){let t=super.toJSON();return t.currentPoint=this.currentPoint.toArray(),t}fromJSON(t){return super.fromJSON(t),this.currentPoint.fromArray(t.currentPoint),this}},ri=class extends yi{constructor(t){super(t),this.uuid=Rs(),this.type="Shape",this.holes=[]}getPointsHoles(t){let e=[];for(let n=0,s=this.holes.length;n<s;n++)e[n]=this.holes[n].getPoints(t);return e}extractPoints(t){return{shape:this.getPoints(t),holes:this.getPointsHoles(t)}}copy(t){super.copy(t),this.holes=[];for(let e=0,n=t.holes.length;e<n;e++){let s=t.holes[e];this.holes.push(s.clone())}return this}toJSON(){let t=super.toJSON();t.uuid=this.uuid,t.holes=[];for(let e=0,n=this.holes.length;e<n;e++){let s=this.holes[e];t.holes.push(s.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.uuid=t.uuid,this.holes=[];for(let e=0,n=t.holes.length;e<n;e++){let s=t.holes[e];this.holes.push(new yi().fromJSON(s))}return this}};function Xd(i,t,e=2){let n=t&&t.length,s=n?t[0]*e:i.length,r=au(i,0,s,e,!0),a=[];if(!r||r.next===r.prev)return a;let o,l,c;if(n&&(r=Jd(i,t,r,e)),i.length>80*e){o=i[0],l=i[1];let h=o,d=l;for(let u=e;u<s;u+=e){let f=i[u],m=i[u+1];f<o&&(o=f),m<l&&(l=m),f>h&&(h=f),m>d&&(d=m)}c=Math.max(h-o,d-l),c=c!==0?32767/c:0}return hr(r,a,e,o,l,c,0),a}function au(i,t,e,n,s){let r;if(s===lf(i,t,e,n)>0)for(let a=t;a<e;a+=n)r=fh(a/n|0,i[a],i[a+1],r);else for(let a=e-n;a>=t;a-=n)r=fh(a/n|0,i[a],i[a+1],r);return r&&Ms(r,r.next)&&(dr(r),r=r.next),r}function ki(i,t){if(!i)return i;t||(t=i);let e=i,n;do if(n=!1,!e.steiner&&(Ms(e,e.next)||Ee(e.prev,e,e.next)===0)){if(dr(e),e=t=e.prev,e===e.next)break;n=!0}else e=e.next;while(n||e!==t);return t}function hr(i,t,e,n,s,r,a){if(!i)return;!a&&r&&ef(i,n,s,r);let o=i;for(;i.prev!==i.next;){let l=i.prev,c=i.next;if(r?Yd(i,n,s,r):qd(i)){t.push(l.i,i.i,c.i),dr(i),i=c.next,o=c.next;continue}if(i=c,i===o){a?a===1?(i=Zd(ki(i),t),hr(i,t,e,n,s,r,2)):a===2&&Kd(i,t,e,n,s,r):hr(ki(i),t,e,n,s,r,1);break}}}function qd(i){let t=i.prev,e=i,n=i.next;if(Ee(t,e,n)>=0)return!1;let s=t.x,r=e.x,a=n.x,o=t.y,l=e.y,c=n.y,h=Math.min(s,r,a),d=Math.min(o,l,c),u=Math.max(s,r,a),f=Math.max(o,l,c),m=n.next;for(;m!==t;){if(m.x>=h&&m.x<=u&&m.y>=d&&m.y<=f&&Gs(s,o,r,l,a,c,m.x,m.y)&&Ee(m.prev,m,m.next)>=0)return!1;m=m.next}return!0}function Yd(i,t,e,n){let s=i.prev,r=i,a=i.next;if(Ee(s,r,a)>=0)return!1;let o=s.x,l=r.x,c=a.x,h=s.y,d=r.y,u=a.y,f=Math.min(o,l,c),m=Math.min(h,d,u),y=Math.max(o,l,c),p=Math.max(h,d,u),g=Pl(f,m,t,e,n),S=Pl(y,p,t,e,n),b=i.prevZ,v=i.nextZ;for(;b&&b.z>=g&&v&&v.z<=S;){if(b.x>=f&&b.x<=y&&b.y>=m&&b.y<=p&&b!==s&&b!==a&&Gs(o,h,l,d,c,u,b.x,b.y)&&Ee(b.prev,b,b.next)>=0||(b=b.prevZ,v.x>=f&&v.x<=y&&v.y>=m&&v.y<=p&&v!==s&&v!==a&&Gs(o,h,l,d,c,u,v.x,v.y)&&Ee(v.prev,v,v.next)>=0))return!1;v=v.nextZ}for(;b&&b.z>=g;){if(b.x>=f&&b.x<=y&&b.y>=m&&b.y<=p&&b!==s&&b!==a&&Gs(o,h,l,d,c,u,b.x,b.y)&&Ee(b.prev,b,b.next)>=0)return!1;b=b.prevZ}for(;v&&v.z<=S;){if(v.x>=f&&v.x<=y&&v.y>=m&&v.y<=p&&v!==s&&v!==a&&Gs(o,h,l,d,c,u,v.x,v.y)&&Ee(v.prev,v,v.next)>=0)return!1;v=v.nextZ}return!0}function Zd(i,t){let e=i;do{let n=e.prev,s=e.next.next;!Ms(n,s)&&lu(n,e,e.next,s)&&ur(n,s)&&ur(s,n)&&(t.push(n.i,e.i,s.i),dr(e),dr(e.next),e=i=s),e=e.next}while(e!==i);return ki(e)}function Kd(i,t,e,n,s,r){let a=i;do{let o=a.next.next;for(;o!==a.prev;){if(a.i!==o.i&&rf(a,o)){let l=cu(a,o);a=ki(a,a.next),l=ki(l,l.next),hr(a,t,e,n,s,r,0),hr(l,t,e,n,s,r,0);return}o=o.next}a=a.next}while(a!==i)}function Jd(i,t,e,n){let s=[];for(let r=0,a=t.length;r<a;r++){let o=t[r]*n,l=r<a-1?t[r+1]*n:i.length,c=au(i,o,l,n,!1);c===c.next&&(c.steiner=!0),s.push(sf(c))}s.sort($d);for(let r=0;r<s.length;r++)e=Qd(s[r],e);return e}function $d(i,t){let e=i.x-t.x;if(e===0&&(e=i.y-t.y,e===0)){let n=(i.next.y-i.y)/(i.next.x-i.x),s=(t.next.y-t.y)/(t.next.x-t.x);e=n-s}return e}function Qd(i,t){let e=jd(i,t);if(!e)return t;let n=cu(e,i);return ki(n,n.next),ki(e,e.next)}function jd(i,t){let e=t,n=i.x,s=i.y,r=-1/0,a;if(Ms(i,e))return e;do{if(Ms(i,e.next))return e.next;if(s<=e.y&&s>=e.next.y&&e.next.y!==e.y){let d=e.x+(s-e.y)*(e.next.x-e.x)/(e.next.y-e.y);if(d<=n&&d>r&&(r=d,a=e.x<e.next.x?e:e.next,d===n))return a}e=e.next}while(e!==t);if(!a)return null;let o=a,l=a.x,c=a.y,h=1/0;e=a;do{if(n>=e.x&&e.x>=l&&n!==e.x&&ou(s<c?n:r,s,l,c,s<c?r:n,s,e.x,e.y)){let d=Math.abs(s-e.y)/(n-e.x);ur(e,i)&&(d<h||d===h&&(e.x>a.x||e.x===a.x&&tf(a,e)))&&(a=e,h=d)}e=e.next}while(e!==o);return a}function tf(i,t){return Ee(i.prev,i,t.prev)<0&&Ee(t.next,i,i.next)<0}function ef(i,t,e,n){let s=i;do s.z===0&&(s.z=Pl(s.x,s.y,t,e,n)),s.prevZ=s.prev,s.nextZ=s.next,s=s.next;while(s!==i);s.prevZ.nextZ=null,s.prevZ=null,nf(s)}function nf(i){let t,e=1;do{let n=i,s;i=null;let r=null;for(t=0;n;){t++;let a=n,o=0;for(let c=0;c<e&&(o++,a=a.nextZ,!!a);c++);let l=e;for(;o>0||l>0&&a;)o!==0&&(l===0||!a||n.z<=a.z)?(s=n,n=n.nextZ,o--):(s=a,a=a.nextZ,l--),r?r.nextZ=s:i=s,s.prevZ=r,r=s;n=a}r.nextZ=null,e*=2}while(t>1);return i}function Pl(i,t,e,n,s){return i=(i-e)*s|0,t=(t-n)*s|0,i=(i|i<<8)&16711935,i=(i|i<<4)&252645135,i=(i|i<<2)&858993459,i=(i|i<<1)&1431655765,t=(t|t<<8)&16711935,t=(t|t<<4)&252645135,t=(t|t<<2)&858993459,t=(t|t<<1)&1431655765,i|t<<1}function sf(i){let t=i,e=i;do(t.x<e.x||t.x===e.x&&t.y<e.y)&&(e=t),t=t.next;while(t!==i);return e}function ou(i,t,e,n,s,r,a,o){return(s-a)*(t-o)>=(i-a)*(r-o)&&(i-a)*(n-o)>=(e-a)*(t-o)&&(e-a)*(r-o)>=(s-a)*(n-o)}function Gs(i,t,e,n,s,r,a,o){return!(i===a&&t===o)&&ou(i,t,e,n,s,r,a,o)}function rf(i,t){return i.next.i!==t.i&&i.prev.i!==t.i&&!af(i,t)&&(ur(i,t)&&ur(t,i)&&of(i,t)&&(Ee(i.prev,i,t.prev)||Ee(i,t.prev,t))||Ms(i,t)&&Ee(i.prev,i,i.next)>0&&Ee(t.prev,t,t.next)>0)}function Ee(i,t,e){return(t.y-i.y)*(e.x-t.x)-(t.x-i.x)*(e.y-t.y)}function Ms(i,t){return i.x===t.x&&i.y===t.y}function lu(i,t,e,n){let s=ta(Ee(i,t,e)),r=ta(Ee(i,t,n)),a=ta(Ee(e,n,i)),o=ta(Ee(e,n,t));return!!(s!==r&&a!==o||s===0&&jr(i,e,t)||r===0&&jr(i,n,t)||a===0&&jr(e,i,n)||o===0&&jr(e,t,n))}function jr(i,t,e){return t.x<=Math.max(i.x,e.x)&&t.x>=Math.min(i.x,e.x)&&t.y<=Math.max(i.y,e.y)&&t.y>=Math.min(i.y,e.y)}function ta(i){return i>0?1:i<0?-1:0}function af(i,t){let e=i;do{if(e.i!==i.i&&e.next.i!==i.i&&e.i!==t.i&&e.next.i!==t.i&&lu(e,e.next,i,t))return!0;e=e.next}while(e!==i);return!1}function ur(i,t){return Ee(i.prev,i,i.next)<0?Ee(i,t,i.next)>=0&&Ee(i,i.prev,t)>=0:Ee(i,t,i.prev)<0||Ee(i,i.next,t)<0}function of(i,t){let e=i,n=!1,s=(i.x+t.x)/2,r=(i.y+t.y)/2;do e.y>r!=e.next.y>r&&e.next.y!==e.y&&s<(e.next.x-e.x)*(r-e.y)/(e.next.y-e.y)+e.x&&(n=!n),e=e.next;while(e!==i);return n}function cu(i,t){let e=Il(i.i,i.x,i.y),n=Il(t.i,t.x,t.y),s=i.next,r=t.prev;return i.next=t,t.prev=i,e.next=s,s.prev=e,n.next=e,e.prev=n,r.next=n,n.prev=r,n}function fh(i,t,e,n){let s=Il(i,t,e);return n?(s.next=n.next,s.prev=n,n.next.prev=s,n.next=s):(s.prev=s,s.next=s),s}function dr(i){i.next.prev=i.prev,i.prev.next=i.next,i.prevZ&&(i.prevZ.nextZ=i.nextZ),i.nextZ&&(i.nextZ.prevZ=i.prevZ)}function Il(i,t,e){return{i,x:t,y:e,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function lf(i,t,e,n){let s=0;for(let r=t,a=e-n;r<e;r+=n)s+=(i[a]-i[r])*(i[r+1]+i[a+1]),a=r;return s}var Ll=class{static triangulate(t,e,n=2){return Xd(t,e,n)}},Oi=class i{static area(t){let e=t.length,n=0;for(let s=e-1,r=0;r<e;s=r++)n+=t[s].x*t[r].y-t[r].x*t[s].y;return n*.5}static isClockWise(t){return i.area(t)<0}static triangulateShape(t,e){let n=[],s=[],r=[];ph(t),mh(n,t);let a=t.length;e.forEach(ph);for(let l=0;l<e.length;l++)s.push(a),a+=e[l].length,mh(n,e[l]);let o=Ll.triangulate(n,s);for(let l=0;l<o.length;l+=3)r.push(o.slice(l,l+3));return r}};function ph(i){let t=i.length;t>2&&i[t-1].equals(i[0])&&i.pop()}function mh(i,t){for(let e=0;e<t.length;e++)i.push(t[e].x),i.push(t[e].y)}var kn=class i extends Ue{constructor(t=new ri([new ht(.5,.5),new ht(-.5,.5),new ht(-.5,-.5),new ht(.5,-.5)]),e={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:t,options:e},t=Array.isArray(t)?t:[t];let n=this,s=[],r=[];for(let o=0,l=t.length;o<l;o++){let c=t[o];a(c)}this.setAttribute("position",new we(s,3)),this.setAttribute("uv",new we(r,2)),this.computeVertexNormals();function a(o){let l=[],c=e.curveSegments!==void 0?e.curveSegments:12,h=e.steps!==void 0?e.steps:1,d=e.depth!==void 0?e.depth:1,u=e.bevelEnabled!==void 0?e.bevelEnabled:!0,f=e.bevelThickness!==void 0?e.bevelThickness:.2,m=e.bevelSize!==void 0?e.bevelSize:f-.1,y=e.bevelOffset!==void 0?e.bevelOffset:0,p=e.bevelSegments!==void 0?e.bevelSegments:3,g=e.extrudePath,S=e.UVGenerator!==void 0?e.UVGenerator:cf,b,v=!1,w,T,R,_;if(g){b=g.getSpacedPoints(h),v=!0,u=!1;let j=g.isCatmullRomCurve3?g.closed:!1;w=g.computeFrenetFrames(h,j),T=new I,R=new I,_=new I}u||(p=0,f=0,m=0,y=0);let E=o.extractPoints(c),P=E.shape,C=E.holes;if(!Oi.isClockWise(P)){P=P.reverse();for(let j=0,rt=C.length;j<rt;j++){let st=C[j];Oi.isClockWise(st)&&(C[j]=st.reverse())}}function W(j){let st=10000000000000001e-36,mt=j[0];for(let ut=1;ut<=j.length;ut++){let Ot=ut%j.length,Rt=j[Ot],Vt=Rt.x-mt.x,Xt=Rt.y-mt.y,L=Vt*Vt+Xt*Xt,ue=Math.max(Math.abs(Rt.x),Math.abs(Rt.y),Math.abs(mt.x),Math.abs(mt.y)),te=st*ue*ue;if(L<=te){j.splice(Ot,1),ut--;continue}mt=Rt}}W(P),C.forEach(W);let X=C.length,O=P;for(let j=0;j<X;j++){let rt=C[j];P=P.concat(rt)}function H(j,rt,st){return rt||Ht("ExtrudeGeometry: vec does not exist"),j.clone().addScaledVector(rt,st)}let V=P.length;function K(j,rt,st){let mt,ut,Ot,Rt=j.x-rt.x,Vt=j.y-rt.y,Xt=st.x-j.x,L=st.y-j.y,ue=Rt*Rt+Vt*Vt,te=Rt*L-Vt*Xt;if(Math.abs(te)>Number.EPSILON){let A=Math.sqrt(ue),x=Math.sqrt(Xt*Xt+L*L),F=rt.x-Vt/A,k=rt.y+Rt/A,q=st.x-L/x,lt=st.y+Xt/x,dt=((q-F)*L-(lt-k)*Xt)/(Rt*L-Vt*Xt);mt=F+Rt*dt-j.x,ut=k+Vt*dt-j.y;let Y=mt*mt+ut*ut;if(Y<=2)return new ht(mt,ut);Ot=Math.sqrt(Y/2)}else{let A=!1;Rt>Number.EPSILON?Xt>Number.EPSILON&&(A=!0):Rt<-Number.EPSILON?Xt<-Number.EPSILON&&(A=!0):Math.sign(Vt)===Math.sign(L)&&(A=!0),A?(mt=-Vt,ut=Rt,Ot=Math.sqrt(ue)):(mt=Rt,ut=Vt,Ot=Math.sqrt(ue/2))}return new ht(mt/Ot,ut/Ot)}let et=[];for(let j=0,rt=O.length,st=rt-1,mt=j+1;j<rt;j++,st++,mt++)st===rt&&(st=0),mt===rt&&(mt=0),et[j]=K(O[j],O[st],O[mt]);let ot=[],ct,it=et.concat();for(let j=0,rt=X;j<rt;j++){let st=C[j];ct=[];for(let mt=0,ut=st.length,Ot=ut-1,Rt=mt+1;mt<ut;mt++,Ot++,Rt++)Ot===ut&&(Ot=0),Rt===ut&&(Rt=0),ct[mt]=K(st[mt],st[Ot],st[Rt]);ot.push(ct),it=it.concat(ct)}let zt;if(p===0)zt=Oi.triangulateShape(O,C);else{let j=[],rt=[];for(let st=0;st<p;st++){let mt=st/p,ut=f*Math.cos(mt*Math.PI/2),Ot=m*Math.sin(mt*Math.PI/2)+y;for(let Rt=0,Vt=O.length;Rt<Vt;Rt++){let Xt=H(O[Rt],et[Rt],Ot);pt(Xt.x,Xt.y,-ut),mt===0&&j.push(Xt)}for(let Rt=0,Vt=X;Rt<Vt;Rt++){let Xt=C[Rt];ct=ot[Rt];let L=[];for(let ue=0,te=Xt.length;ue<te;ue++){let A=H(Xt[ue],ct[ue],Ot);pt(A.x,A.y,-ut),mt===0&&L.push(A)}mt===0&&rt.push(L)}}zt=Oi.triangulateShape(j,rt)}let $t=zt.length,Zt=m+y;for(let j=0;j<V;j++){let rt=u?H(P[j],it[j],Zt):P[j];v?(R.copy(w.normals[0]).multiplyScalar(rt.x),T.copy(w.binormals[0]).multiplyScalar(rt.y),_.copy(b[0]).add(R).add(T),pt(_.x,_.y,_.z)):pt(rt.x,rt.y,0)}for(let j=1;j<=h;j++)for(let rt=0;rt<V;rt++){let st=u?H(P[rt],it[rt],Zt):P[rt];v?(R.copy(w.normals[j]).multiplyScalar(st.x),T.copy(w.binormals[j]).multiplyScalar(st.y),_.copy(b[j]).add(R).add(T),pt(_.x,_.y,_.z)):pt(st.x,st.y,d/h*j)}for(let j=p-1;j>=0;j--){let rt=j/p,st=f*Math.cos(rt*Math.PI/2),mt=m*Math.sin(rt*Math.PI/2)+y;for(let ut=0,Ot=O.length;ut<Ot;ut++){let Rt=H(O[ut],et[ut],mt);pt(Rt.x,Rt.y,d+st)}for(let ut=0,Ot=C.length;ut<Ot;ut++){let Rt=C[ut];ct=ot[ut];for(let Vt=0,Xt=Rt.length;Vt<Xt;Vt++){let L=H(Rt[Vt],ct[Vt],mt);v?pt(L.x,L.y+b[h-1].y,b[h-1].x+st):pt(L.x,L.y,d+st)}}}Z(),at();function Z(){let j=s.length/3;if(u){let rt=0,st=V*rt;for(let mt=0;mt<$t;mt++){let ut=zt[mt];Ft(ut[2]+st,ut[1]+st,ut[0]+st)}rt=h+p*2,st=V*rt;for(let mt=0;mt<$t;mt++){let ut=zt[mt];Ft(ut[0]+st,ut[1]+st,ut[2]+st)}}else{for(let rt=0;rt<$t;rt++){let st=zt[rt];Ft(st[2],st[1],st[0])}for(let rt=0;rt<$t;rt++){let st=zt[rt];Ft(st[0]+V*h,st[1]+V*h,st[2]+V*h)}}n.addGroup(j,s.length/3-j,0)}function at(){let j=s.length/3,rt=0;tt(O,rt),rt+=O.length;for(let st=0,mt=C.length;st<mt;st++){let ut=C[st];tt(ut,rt),rt+=ut.length}n.addGroup(j,s.length/3-j,1)}function tt(j,rt){let st=j.length;for(;--st>=0;){let mt=st,ut=st-1;ut<0&&(ut=j.length-1);for(let Ot=0,Rt=h+p*2;Ot<Rt;Ot++){let Vt=V*Ot,Xt=V*(Ot+1),L=rt+mt+Vt,ue=rt+ut+Vt,te=rt+ut+Xt,A=rt+mt+Xt;Pt(L,ue,te,A)}}}function pt(j,rt,st){l.push(j),l.push(rt),l.push(st)}function Ft(j,rt,st){ne(j),ne(rt),ne(st);let mt=s.length/3,ut=S.generateTopUV(n,s,mt-3,mt-2,mt-1);kt(ut[0]),kt(ut[1]),kt(ut[2])}function Pt(j,rt,st,mt){ne(j),ne(rt),ne(mt),ne(rt),ne(st),ne(mt);let ut=s.length/3,Ot=S.generateSideWallUV(n,s,ut-6,ut-3,ut-2,ut-1);kt(Ot[0]),kt(Ot[1]),kt(Ot[3]),kt(Ot[1]),kt(Ot[2]),kt(Ot[3])}function ne(j){s.push(l[j*3+0]),s.push(l[j*3+1]),s.push(l[j*3+2])}function kt(j){r.push(j.x),r.push(j.y)}}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){let t=super.toJSON(),e=this.parameters.shapes,n=this.parameters.options;return hf(e,n,t)}static fromJSON(t,e){let n=[];for(let r=0,a=t.shapes.length;r<a;r++){let o=e[t.shapes[r]];n.push(o)}let s=t.options.extrudePath;return s!==void 0&&(t.options.extrudePath=new Cl[s.type]().fromJSON(s)),new i(n,t.options)}},cf={generateTopUV:function(i,t,e,n,s){let r=t[e*3],a=t[e*3+1],o=t[n*3],l=t[n*3+1],c=t[s*3],h=t[s*3+1];return[new ht(r,a),new ht(o,l),new ht(c,h)]},generateSideWallUV:function(i,t,e,n,s,r){let a=t[e*3],o=t[e*3+1],l=t[e*3+2],c=t[n*3],h=t[n*3+1],d=t[n*3+2],u=t[s*3],f=t[s*3+1],m=t[s*3+2],y=t[r*3],p=t[r*3+1],g=t[r*3+2];return Math.abs(o-h)<Math.abs(a-c)?[new ht(a,1-l),new ht(c,1-d),new ht(u,1-m),new ht(y,1-g)]:[new ht(o,1-l),new ht(h,1-d),new ht(f,1-m),new ht(p,1-g)]}};function hf(i,t,e){if(e.shapes=[],Array.isArray(i))for(let n=0,s=i.length;n<s;n++){let r=i[n];e.shapes.push(r.uuid)}else e.shapes.push(i.uuid);return e.options=Object.assign({},t),t.extrudePath!==void 0&&(e.options.extrudePath=t.extrudePath.toJSON()),e}var $e=class i extends Ue{constructor(t=1,e=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:n,heightSegments:s};let r=t/2,a=e/2,o=Math.floor(n),l=Math.floor(s),c=o+1,h=l+1,d=t/o,u=e/l,f=[],m=[],y=[],p=[];for(let g=0;g<h;g++){let S=g*u-a;for(let b=0;b<c;b++){let v=b*d-r;m.push(v,-S,0),y.push(0,0,1),p.push(b/o),p.push(1-g/l)}}for(let g=0;g<l;g++)for(let S=0;S<o;S++){let b=S+c*g,v=S+c*(g+1),w=S+1+c*(g+1),T=S+1+c*g;f.push(b,v,T),f.push(v,w,T)}this.setIndex(f),this.setAttribute("position",new we(m,3)),this.setAttribute("normal",new we(y,3)),this.setAttribute("uv",new we(p,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.width,t.height,t.widthSegments,t.heightSegments)}};var Rn=class i extends Ue{constructor(t=1,e=32,n=16,s=0,r=Math.PI*2,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:n,phiStart:s,phiLength:r,thetaStart:a,thetaLength:o},e=Math.max(3,Math.floor(e)),n=Math.max(2,Math.floor(n));let l=Math.min(a+o,Math.PI),c=0,h=[],d=new I,u=new I,f=[],m=[],y=[],p=[];for(let g=0;g<=n;g++){let S=[],b=g/n,v=a+b*o,w=t*Math.cos(v),T=Math.sqrt(t*t-w*w),R=0;g===0&&a===0?R=.5/e:g===n&&l===Math.PI&&(R=-.5/e);for(let _=0;_<=e;_++){let E=_/e,P=s+E*r;d.x=-T*Math.cos(P),d.y=w,d.z=T*Math.sin(P),m.push(d.x,d.y,d.z),u.copy(d).normalize(),y.push(u.x,u.y,u.z),p.push(E+R,1-b),S.push(c++)}h.push(S)}for(let g=0;g<n;g++)for(let S=0;S<e;S++){let b=h[g][S+1],v=h[g][S],w=h[g+1][S],T=h[g+1][S+1];(g!==0||a>0)&&f.push(b,v,T),(g!==n-1||l<Math.PI)&&f.push(v,w,T)}this.setIndex(f),this.setAttribute("position",new we(m,3)),this.setAttribute("normal",new we(y,3)),this.setAttribute("uv",new we(p,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}};var Ss=class i extends Ue{constructor(t=1,e=.4,n=12,s=48,r=Math.PI*2,a=0,o=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:t,tube:e,radialSegments:n,tubularSegments:s,arc:r,thetaStart:a,thetaLength:o},n=Math.floor(n),s=Math.floor(s);let l=[],c=[],h=[],d=[],u=new I,f=new I,m=new I;for(let y=0;y<=n;y++){let p=a+y/n*o;for(let g=0;g<=s;g++){let S=g/s*r;f.x=(t+e*Math.cos(p))*Math.cos(S),f.y=(t+e*Math.cos(p))*Math.sin(S),f.z=e*Math.sin(p),c.push(f.x,f.y,f.z),u.x=t*Math.cos(S),u.y=t*Math.sin(S),m.subVectors(f,u).normalize(),h.push(m.x,m.y,m.z),d.push(g/s),d.push(y/n)}}for(let y=1;y<=n;y++)for(let p=1;p<=s;p++){let g=(s+1)*y+p-1,S=(s+1)*(y-1)+p-1,b=(s+1)*(y-1)+p,v=(s+1)*y+p;l.push(g,S,v),l.push(S,b,v)}this.setIndex(l),this.setAttribute("position",new we(c,3)),this.setAttribute("normal",new we(h,3)),this.setAttribute("uv",new we(d,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radius,t.tube,t.radialSegments,t.tubularSegments,t.arc)}};function Xi(i){let t={};for(let e in i){t[e]={};for(let n in i[e]){let s=i[e][n];if(gh(s))s.isRenderTargetTexture?(Gt("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][n]=null):t[e][n]=s.clone();else if(Array.isArray(s))if(gh(s[0])){let r=[];for(let a=0,o=s.length;a<o;a++)r[a]=s[a].clone();t[e][n]=r}else t[e][n]=s.slice();else t[e][n]=s}}return t}function Qe(i){let t={};for(let e=0;e<i.length;e++){let n=Xi(i[e]);for(let s in n)t[s]=n[s]}return t}function gh(i){return i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)}function uf(i){let t=[];for(let e=0;e<i.length;e++)t.push(i[e].clone());return t}function oc(i){let t=i.getRenderTarget();return t===null?i.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:se.workingColorSpace}var hu={clone:Xi,merge:Qe},df=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,ff=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,sn=class extends ni{constructor(t){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=df,this.fragmentShader=ff,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=Xi(t.uniforms),this.uniformsGroups=uf(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this.defaultAttributeValues=Object.assign({},t.defaultAttributeValues),this.index0AttributeName=t.index0AttributeName,this.uniformsNeedUpdate=t.uniformsNeedUpdate,this}toJSON(t){let e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(let s in this.uniforms){let a=this.uniforms[s].value;a&&a.isTexture?e.uniforms[s]={type:"t",value:a.toJSON(t).uuid}:a&&a.isColor?e.uniforms[s]={type:"c",value:a.getHex()}:a&&a.isVector2?e.uniforms[s]={type:"v2",value:a.toArray()}:a&&a.isVector3?e.uniforms[s]={type:"v3",value:a.toArray()}:a&&a.isVector4?e.uniforms[s]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?e.uniforms[s]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?e.uniforms[s]={type:"m4",value:a.toArray()}:e.uniforms[s]={value:a}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;let n={};for(let s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(e.extensions=n),e}fromJSON(t,e){if(super.fromJSON(t,e),t.uniforms!==void 0)for(let n in t.uniforms){let s=t.uniforms[n];switch(this.uniforms[n]={},s.type){case"t":this.uniforms[n].value=e[s.value]||null;break;case"c":this.uniforms[n].value=new Yt().setHex(s.value);break;case"v2":this.uniforms[n].value=new ht().fromArray(s.value);break;case"v3":this.uniforms[n].value=new I().fromArray(s.value);break;case"v4":this.uniforms[n].value=new Te().fromArray(s.value);break;case"m3":this.uniforms[n].value=new qt().fromArray(s.value);break;case"m4":this.uniforms[n].value=new ve().fromArray(s.value);break;default:this.uniforms[n].value=s.value}}if(t.defines!==void 0&&(this.defines=t.defines),t.vertexShader!==void 0&&(this.vertexShader=t.vertexShader),t.fragmentShader!==void 0&&(this.fragmentShader=t.fragmentShader),t.glslVersion!==void 0&&(this.glslVersion=t.glslVersion),t.extensions!==void 0)for(let n in t.extensions)this.extensions[n]=t.extensions[n];return t.lights!==void 0&&(this.lights=t.lights),t.clipping!==void 0&&(this.clipping=t.clipping),this}},Ra=class extends sn{constructor(t){super(t),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}},Qt=class extends ni{constructor(t){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new Yt(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Yt(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Co,this.normalScale=new ht(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new ei,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.defines={STANDARD:""},this.color.copy(t.color),this.roughness=t.roughness,this.metalness=t.metalness,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.roughnessMap=t.roughnessMap,this.metalnessMap=t.metalnessMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.envMapIntensity=t.envMapIntensity,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}};var Ca=class extends ni{constructor(t){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Yh,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}},Pa=class extends ni{constructor(t){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}};function ea(i,t){return!i||i.constructor===t?i:typeof t.BYTES_PER_ELEMENT=="number"?new t(i):Array.prototype.slice.call(i)}var Mi=class{constructor(t,e,n,s){this.parameterPositions=t,this._cachedIndex=0,this.resultBuffer=s!==void 0?s:new e.constructor(n),this.sampleValues=e,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(t){let e=this.parameterPositions,n=this._cachedIndex,s=e[n],r=e[n-1];n:{t:{let a;e:{i:if(!(t<s)){for(let o=n+2;;){if(s===void 0){if(t<r)break i;return n=e.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===o)break;if(r=s,s=e[++n],t<s)break t}a=e.length;break e}if(!(t>=r)){let o=e[1];t<o&&(n=2,r=o);for(let l=n-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===l)break;if(s=r,r=e[--n-1],t>=r)break t}a=n,n=0;break e}break n}for(;n<a;){let o=n+a>>>1;t<e[o]?a=o:n=o+1}if(s=e[n],r=e[n-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(s===void 0)return n=e.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,r,s)}return this.interpolate_(n,r,t,s)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(t){let e=this.resultBuffer,n=this.sampleValues,s=this.valueSize,r=t*s;for(let a=0;a!==s;++a)e[a]=n[r+a];return e}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},Ia=class extends Mi{constructor(t,e,n,s){super(t,e,n,s),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:bl,endingEnd:bl}}intervalChanged_(t,e,n){let s=this.parameterPositions,r=t-2,a=t+1,o=s[r],l=s[a];if(o===void 0)switch(this.getSettings_().endingStart){case Tl:r=t,o=2*e-n;break;case El:r=s.length-2,o=e+s[r]-s[r+1];break;default:r=t,o=n}if(l===void 0)switch(this.getSettings_().endingEnd){case Tl:a=t,l=2*n-e;break;case El:a=1,l=n+s[1]-s[0];break;default:a=t-1,l=e}let c=(n-e)*.5,h=this.valueSize;this._weightPrev=c/(e-o),this._weightNext=c/(l-n),this._offsetPrev=r*h,this._offsetNext=a*h}interpolate_(t,e,n,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=t*o,c=l-o,h=this._offsetPrev,d=this._offsetNext,u=this._weightPrev,f=this._weightNext,m=(n-e)/(s-e),y=m*m,p=y*m,g=-u*p+2*u*y-u*m,S=(1+u)*p+(-1.5-2*u)*y+(-.5+u)*m+1,b=(-1-f)*p+(1.5+f)*y+.5*m,v=f*p-f*y;for(let w=0;w!==o;++w)r[w]=g*a[h+w]+S*a[c+w]+b*a[l+w]+v*a[d+w];return r}},La=class extends Mi{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t,e,n,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=t*o,c=l-o,h=(n-e)/(s-e),d=1-h;for(let u=0;u!==o;++u)r[u]=a[c+u]*d+a[l+u]*h;return r}},Da=class extends Mi{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t){return this.copySampleValue_(t-1)}},Na=class extends Mi{interpolate_(t,e,n,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=t*o,c=l-o,h=this.inTangents,d=this.outTangents;if(!h||!d){let m=(n-e)/(s-e),y=1-m;for(let p=0;p!==o;++p)r[p]=a[c+p]*y+a[l+p]*m;return r}let u=o*2,f=t-1;for(let m=0;m!==o;++m){let y=a[c+m],p=a[l+m],g=f*u+m*2,S=d[g],b=d[g+1],v=t*u+m*2,w=h[v],T=h[v+1],R=(n-e)/(s-e),_,E,P,C,D;for(let W=0;W<8;W++){_=R*R,E=_*R,P=1-R,C=P*P,D=C*P;let O=D*e+3*C*R*S+3*P*_*w+E*s-n;if(Math.abs(O)<1e-10)break;let H=3*C*(S-e)+6*P*R*(w-S)+3*_*(s-w);if(Math.abs(H)<1e-10)break;R=R-O/H,R=Math.max(0,Math.min(1,R))}r[m]=D*y+3*C*R*b+3*P*_*T+E*p}return r}},mn=class{constructor(t,e,n,s){if(t===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(e===void 0||e.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+t);this.name=t,this.times=ea(e,this.TimeBufferType),this.values=ea(n,this.ValueBufferType),this.setInterpolation(s||this.DefaultInterpolation)}static toJSON(t){let e=t.constructor,n;if(e.toJSON!==this.toJSON)n=e.toJSON(t);else{n={name:t.name,times:ea(t.times,Array),values:ea(t.values,Array)};let s=t.getInterpolation();s!==t.DefaultInterpolation&&(n.interpolation=s)}return n.type=t.ValueTypeName,n}InterpolantFactoryMethodDiscrete(t){return new Da(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodLinear(t){return new La(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodSmooth(t){return new Ia(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodBezier(t){let e=new Na(this.times,this.values,this.getValueSize(),t);return this.settings&&(e.inTangents=this.settings.inTangents,e.outTangents=this.settings.outTangents),e}setInterpolation(t){let e;switch(t){case qs:e=this.InterpolantFactoryMethodDiscrete;break;case ma:e=this.InterpolantFactoryMethodLinear;break;case sa:e=this.InterpolantFactoryMethodSmooth;break;case Sl:e=this.InterpolantFactoryMethodBezier;break}if(e===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(t!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return Gt("KeyframeTrack:",n),this}return this.createInterpolant=e,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return qs;case this.InterpolantFactoryMethodLinear:return ma;case this.InterpolantFactoryMethodSmooth:return sa;case this.InterpolantFactoryMethodBezier:return Sl}}getValueSize(){return this.values.length/this.times.length}shift(t){if(t!==0){let e=this.times;for(let n=0,s=e.length;n!==s;++n)e[n]+=t}return this}scale(t){if(t!==1){let e=this.times;for(let n=0,s=e.length;n!==s;++n)e[n]*=t}return this}trim(t,e){let n=this.times,s=n.length,r=0,a=s-1;for(;r!==s&&n[r]<t;)++r;for(;a!==-1&&n[a]>e;)--a;if(++a,r!==0||a!==s){r>=a&&(a=Math.max(a,1),r=a-1);let o=this.getValueSize();this.times=n.slice(r,a),this.values=this.values.slice(r*o,a*o)}return this}validate(){let t=!0,e=this.getValueSize();e-Math.floor(e)!==0&&(Ht("KeyframeTrack: Invalid value size in track.",this),t=!1);let n=this.times,s=this.values,r=n.length;r===0&&(Ht("KeyframeTrack: Track is empty.",this),t=!1);let a=null;for(let o=0;o!==r;o++){let l=n[o];if(typeof l=="number"&&isNaN(l)){Ht("KeyframeTrack: Time is not a valid number.",this,o,l),t=!1;break}if(a!==null&&a>l){Ht("KeyframeTrack: Out of order keys.",this,o,l,a),t=!1;break}a=l}if(s!==void 0&&xd(s))for(let o=0,l=s.length;o!==l;++o){let c=s[o];if(isNaN(c)){Ht("KeyframeTrack: Value is not a valid number.",this,o,c),t=!1;break}}return t}optimize(){let t=this.times.slice(),e=this.values.slice(),n=this.getValueSize(),s=this.getInterpolation()===sa,r=t.length-1,a=1;for(let o=1;o<r;++o){let l=!1,c=t[o],h=t[o+1];if(c!==h&&(o!==1||c!==t[0]))if(s)l=!0;else{let d=o*n,u=d-n,f=d+n;for(let m=0;m!==n;++m){let y=e[d+m];if(y!==e[u+m]||y!==e[f+m]){l=!0;break}}}if(l){if(o!==a){t[a]=t[o];let d=o*n,u=a*n;for(let f=0;f!==n;++f)e[u+f]=e[d+f]}++a}}if(r>0){t[a]=t[r];for(let o=r*n,l=a*n,c=0;c!==n;++c)e[l+c]=e[o+c];++a}return a!==t.length?(this.times=t.slice(0,a),this.values=e.slice(0,a*n)):(this.times=t,this.values=e),this}clone(){let t=this.times.slice(),e=this.values.slice(),n=this.constructor,s=new n(this.name,t,e);return s.createInterpolant=this.createInterpolant,s}};mn.prototype.ValueTypeName="";mn.prototype.TimeBufferType=Float32Array;mn.prototype.ValueBufferType=Float32Array;mn.prototype.DefaultInterpolation=ma;var Si=class extends mn{constructor(t,e,n){super(t,e,n)}};Si.prototype.ValueTypeName="bool";Si.prototype.ValueBufferType=Array;Si.prototype.DefaultInterpolation=qs;Si.prototype.InterpolantFactoryMethodLinear=void 0;Si.prototype.InterpolantFactoryMethodSmooth=void 0;var Ua=class extends mn{constructor(t,e,n,s){super(t,e,n,s)}};Ua.prototype.ValueTypeName="color";var Fa=class extends mn{constructor(t,e,n,s){super(t,e,n,s)}};Fa.prototype.ValueTypeName="number";var Oa=class extends Mi{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t,e,n,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=(n-e)/(s-e),c=t*o;for(let h=c+o;c!==h;c+=4)zn.slerpFlat(r,0,a,c-o,a,c,l);return r}},fr=class extends mn{constructor(t,e,n,s){super(t,e,n,s)}InterpolantFactoryMethodLinear(t){return new Oa(this.times,this.values,this.getValueSize(),t)}};fr.prototype.ValueTypeName="quaternion";fr.prototype.InterpolantFactoryMethodSmooth=void 0;var bi=class extends mn{constructor(t,e,n){super(t,e,n)}};bi.prototype.ValueTypeName="string";bi.prototype.ValueBufferType=Array;bi.prototype.DefaultInterpolation=qs;bi.prototype.InterpolantFactoryMethodLinear=void 0;bi.prototype.InterpolantFactoryMethodSmooth=void 0;var Ba=class extends mn{constructor(t,e,n,s){super(t,e,n,s)}};Ba.prototype.ValueTypeName="vector";var za=class{constructor(t,e,n){let s=this,r=!1,a=0,o=0,l,c=[];this.onStart=void 0,this.onLoad=t,this.onProgress=e,this.onError=n,this._abortController=null,this.itemStart=function(h){o++,r===!1&&s.onStart!==void 0&&s.onStart(h,a,o),r=!0},this.itemEnd=function(h){a++,s.onProgress!==void 0&&s.onProgress(h,a,o),a===o&&(r=!1,s.onLoad!==void 0&&s.onLoad())},this.itemError=function(h){s.onError!==void 0&&s.onError(h)},this.resolveURL=function(h){return h=h.normalize("NFC"),l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,d){return c.push(h,d),this},this.removeHandler=function(h){let d=c.indexOf(h);return d!==-1&&c.splice(d,2),this},this.getHandler=function(h){for(let d=0,u=c.length;d<u;d+=2){let f=c[d],m=c[d+1];if(f.global&&(f.lastIndex=0),f.test(h))return m}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},uu=new za,ka=class{constructor(t){this.manager=t!==void 0?t:uu,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__!="undefined"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(t,e){let n=this;return new Promise(function(s,r){n.load(t,s,e,r)})}parse(){}setCrossOrigin(t){return this.crossOrigin=t,this}setWithCredentials(t){return this.withCredentials=t,this}setPath(t){return this.path=t,this}setResourcePath(t){return this.resourcePath=t,this}setRequestHeader(t){return this.requestHeader=t,this}abort(){return this}};ka.DEFAULT_MATERIAL_NAME="__DEFAULT";var Vi=class extends Ne{constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new Yt(t),this.intensity=e}dispose(){this.dispatchEvent({type:"dispose"})}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){let e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,e}},pr=class extends Vi{constructor(t,e,n){super(t,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Ne.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Yt(e)}copy(t,e){return super.copy(t,e),this.groundColor.copy(t.groundColor),this}toJSON(t){let e=super.toJSON(t);return e.object.groundColor=this.groundColor.getHex(),e}},Ml=new ve,_h=new I,xh=new I,mr=class{constructor(t){this.camera=t,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new ht(512,512),this.mapType=on,this.map=null,this.mapPass=null,this.matrix=new ve,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new xs,this._frameExtents=new ht(1,1),this._viewportCount=1,this._viewports=[new Te(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(t){let e=this.camera,n=this.matrix;_h.setFromMatrixPosition(t.matrixWorld),e.position.copy(_h),xh.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(xh),e.updateMatrixWorld(),Ml.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Ml,e.coordinateSystem,e.reversedDepth),e.coordinateSystem===ds||e.reversedDepth?n.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(Ml)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.intensity=t.intensity,this.bias=t.bias,this.radius=t.radius,this.autoUpdate=t.autoUpdate,this.needsUpdate=t.needsUpdate,this.normalBias=t.normalBias,this.blurSamples=t.blurSamples,this.mapSize.copy(t.mapSize),this.biasNode=t.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let t={};return this.intensity!==1&&(t.intensity=this.intensity),this.bias!==0&&(t.bias=this.bias),this.normalBias!==0&&(t.normalBias=this.normalBias),this.radius!==1&&(t.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(t.mapSize=this.mapSize.toArray()),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}},na=new I,ia=new zn,Un=new I,gr=class extends Ne{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new ve,this.projectionMatrix=new ve,this.projectionMatrixInverse=new ve,this.coordinateSystem=wn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorld.decompose(na,ia,Un),Un.x===1&&Un.y===1&&Un.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(na,ia,Un.set(1,1,1)).invert()}updateWorldMatrix(t,e,n=!1){super.updateWorldMatrix(t,e,n),this.matrixWorld.decompose(na,ia,Un),Un.x===1&&Un.y===1&&Un.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(na,ia,Un.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},gi=new I,vh=new ht,yh=new ht,ze=class extends gr{constructor(t=50,e=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){let e=.5*this.getFilmHeight()/t;this.fov=Js*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){let t=Math.tan(Ko*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return Js*2*Math.atan(Math.tan(Ko*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,e,n){gi.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),e.set(gi.x,gi.y).multiplyScalar(-t/gi.z),gi.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(gi.x,gi.y).multiplyScalar(-t/gi.z)}getViewSize(t,e){return this.getViewBounds(t,vh,yh),e.subVectors(yh,vh)}setViewOffset(t,e,n,s,r,a){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=this.near,e=t*Math.tan(Ko*.5*this.fov)/this.zoom,n=2*e,s=this.aspect*n,r=-.5*s,a=this.view;if(this.view!==null&&this.view.enabled){let l=a.fullWidth,c=a.fullHeight;r+=a.offsetX*s/l,e-=a.offsetY*n/c,s*=a.width/l,n*=a.height/c}let o=this.filmOffset;o!==0&&(r+=t*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,e,e-n,t,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}},Dl=class extends mr{constructor(){super(new ze(50,1,.5,500)),this.isSpotLightShadow=!0,this.focus=1,this.aspect=1}updateMatrices(t){let e=this.camera,n=Js*2*t.angle*this.focus,s=this.mapSize.width/this.mapSize.height*this.aspect,r=t.distance||e.far;(n!==e.fov||s!==e.aspect||r!==e.far)&&(e.fov=n,e.aspect=s,e.far=r,e.updateProjectionMatrix()),super.updateMatrices(t)}copy(t){return super.copy(t),this.focus=t.focus,this}},_r=class extends Vi{constructor(t,e,n=0,s=Math.PI/3,r=0,a=2){super(t,e),this.isSpotLight=!0,this.type="SpotLight",this.position.copy(Ne.DEFAULT_UP),this.updateMatrix(),this.target=new Ne,this.distance=n,this.angle=s,this.penumbra=r,this.decay=a,this.map=null,this.shadow=new Dl}get power(){return this.intensity*Math.PI}set power(t){this.intensity=t/Math.PI}dispose(){super.dispose(),this.shadow.dispose()}copy(t,e){return super.copy(t,e),this.distance=t.distance,this.angle=t.angle,this.penumbra=t.penumbra,this.decay=t.decay,this.target=t.target.clone(),this.map=t.map,this.shadow=t.shadow.clone(),this}toJSON(t){let e=super.toJSON(t);return e.object.distance=this.distance,e.object.angle=this.angle,e.object.decay=this.decay,e.object.penumbra=this.penumbra,e.object.target=this.target.uuid,this.map&&this.map.isTexture&&(e.object.map=this.map.toJSON(t).uuid),e.object.shadow=this.shadow.toJSON(),e}},Nl=class extends mr{constructor(){super(new ze(90,1,.5,500)),this.isPointLightShadow=!0}},Hi=class extends Vi{constructor(t,e,n=0,s=2){super(t,e),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=s,this.shadow=new Nl}get power(){return this.intensity*4*Math.PI}set power(t){this.intensity=t/(4*Math.PI)}dispose(){super.dispose(),this.shadow.dispose()}copy(t,e){return super.copy(t,e),this.distance=t.distance,this.decay=t.decay,this.shadow=t.shadow.clone(),this}toJSON(t){let e=super.toJSON(t);return e.object.distance=this.distance,e.object.decay=this.decay,e.object.shadow=this.shadow.toJSON(),e}},bs=class extends gr{constructor(t=-1,e=1,n=1,s=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=n,this.bottom=s,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,n,s,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2,r=n-t,a=n+t,o=s+e,l=s-e;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,a=r+c*this.view.width,o-=h*this.view.offsetY,l=o-h*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}},Ul=class extends mr{constructor(){super(new bs(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},xr=class extends Vi{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Ne.DEFAULT_UP),this.updateMatrix(),this.target=new Ne,this.shadow=new Ul}dispose(){super.dispose(),this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}toJSON(t){let e=super.toJSON(t);return e.object.shadow=this.shadow.toJSON(),e.object.target=this.target.uuid,e}};var cs=-90,hs=1,Va=class extends Ne{constructor(t,e,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let s=new ze(cs,hs,t,e);s.layers=this.layers,this.add(s);let r=new ze(cs,hs,t,e);r.layers=this.layers,this.add(r);let a=new ze(cs,hs,t,e);a.layers=this.layers,this.add(a);let o=new ze(cs,hs,t,e);o.layers=this.layers,this.add(o);let l=new ze(cs,hs,t,e);l.layers=this.layers,this.add(l);let c=new ze(cs,hs,t,e);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let t=this.coordinateSystem,e=this.children.concat(),[n,s,r,a,o,l]=e;for(let c of e)this.remove(c);if(t===wn)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(t===ds)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(let c of e)this.add(c),c.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());let[r,a,o,l,c,h]=this.children,d=t.getRenderTarget(),u=t.getActiveCubeFace(),f=t.getActiveMipmapLevel(),m=t.xr.enabled;t.xr.enabled=!1;let y=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let p=!1;t.isWebGLRenderer===!0?p=t.state.buffers.depth.getReversed():p=t.reversedDepthBuffer,t.setRenderTarget(n,0,s),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,r),t.setRenderTarget(n,1,s),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,a),t.setRenderTarget(n,2,s),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,o),t.setRenderTarget(n,3,s),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,l),t.setRenderTarget(n,4,s),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,c),n.texture.generateMipmaps=y,t.setRenderTarget(n,5,s),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,h),t.setRenderTarget(d,u,f),t.xr.enabled=m,n.texture.needsPMREMUpdate=!0}},Ha=class extends ze{constructor(t=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=t}};var lc="\\[\\]\\.:\\/",pf=new RegExp("["+lc+"]","g"),cc="[^"+lc+"]",mf="[^"+lc.replace("\\.","")+"]",gf=/((?:WC+[\/:])*)/.source.replace("WC",cc),_f=/(WCOD+)?/.source.replace("WCOD",mf),xf=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",cc),vf=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",cc),yf=new RegExp("^"+gf+_f+xf+vf+"$"),Mf=["material","materials","bones","map"],Fl=class{constructor(t,e,n){let s=n||Me.parseTrackName(e);this._targetGroup=t,this._bindings=t.subscribe_(e,s)}getValue(t,e){this.bind();let n=this._targetGroup.nCachedObjects_,s=this._bindings[n];s!==void 0&&s.getValue(t,e)}setValue(t,e){let n=this._bindings;for(let s=this._targetGroup.nCachedObjects_,r=n.length;s!==r;++s)n[s].setValue(t,e)}bind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,n=t.length;e!==n;++e)t[e].bind()}unbind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,n=t.length;e!==n;++e)t[e].unbind()}},Me=class i{constructor(t,e,n){this.path=e,this.parsedPath=n||i.parseTrackName(e),this.node=i.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,e,n){return t&&t.isAnimationObjectGroup?new i.Composite(t,e,n):new i(t,e,n)}static sanitizeNodeName(t){return t.replace(/\s/g,"_").replace(pf,"")}static parseTrackName(t){let e=yf.exec(t);if(e===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+t);let n={nodeName:e[2],objectName:e[3],objectIndex:e[4],propertyName:e[5],propertyIndex:e[6]},s=n.nodeName&&n.nodeName.lastIndexOf(".");if(s!==void 0&&s!==-1){let r=n.nodeName.substring(s+1);Mf.indexOf(r)!==-1&&(n.nodeName=n.nodeName.substring(0,s),n.objectName=r)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+t);return n}static findNode(t,e){if(e===void 0||e===""||e==="."||e===-1||e===t.name||e===t.uuid)return t;if(t.skeleton){let n=t.skeleton.getBoneByName(e);if(n!==void 0)return n}if(t.children){let n=function(r){for(let a=0;a<r.length;a++){let o=r[a];if(o.name===e||o.uuid===e)return o;let l=n(o.children);if(l)return l}return null},s=n(t.children);if(s)return s}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(t,e){t[e]=this.targetObject[this.propertyName]}_getValue_array(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)t[e++]=n[s]}_getValue_arrayElement(t,e){t[e]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(t,e){this.resolvedProperty.toArray(t,e)}_setValue_direct(t,e){this.targetObject[this.propertyName]=t[e]}_setValue_direct_setNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++]}_setValue_array_setNeedsUpdate(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(t,e){this.resolvedProperty[this.propertyIndex]=t[e]}_setValue_arrayElement_setNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(t,e){this.resolvedProperty.fromArray(t,e)}_setValue_fromArray_setNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(t,e){this.bind(),this.getValue(t,e)}_setValue_unbound(t,e){this.bind(),this.setValue(t,e)}bind(){let t=this.node,e=this.parsedPath,n=e.objectName,s=e.propertyName,r=e.propertyIndex;if(t||(t=i.findNode(this.rootNode,e.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){Gt("PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let c=e.objectIndex;switch(n){case"materials":if(!t.material){Ht("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.materials){Ht("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}t=t.material.materials;break;case"bones":if(!t.skeleton){Ht("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}t=t.skeleton.bones;for(let h=0;h<t.length;h++)if(t[h].name===c){c=h;break}break;case"map":if("map"in t){t=t.map;break}if(!t.material){Ht("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.map){Ht("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}t=t.material.map;break;default:if(t[n]===void 0){Ht("PropertyBinding: Can not bind to objectName of node undefined.",this);return}t=t[n]}if(c!==void 0){if(t[c]===void 0){Ht("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,t);return}t=t[c]}}let a=t[s];if(a===void 0){let c=e.nodeName;Ht("PropertyBinding: Trying to update property for track: "+c+"."+s+" but it wasn't found.",t);return}let o=this.Versioning.None;this.targetObject=t,t.isMaterial===!0?o=this.Versioning.NeedsUpdate:t.isObject3D===!0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(r!==void 0){if(s==="morphTargetInfluences"){if(!t.geometry){Ht("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!t.geometry.morphAttributes){Ht("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}t.morphTargetDictionary[r]!==void 0&&(r=t.morphTargetDictionary[r])}l=this.BindingType.ArrayElement,this.resolvedProperty=a,this.propertyIndex=r}else a.fromArray!==void 0&&a.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=a):Array.isArray(a)?(l=this.BindingType.EntireArray,this.resolvedProperty=a):this.propertyName=s;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};Me.Composite=Fl;Me.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};Me.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};Me.prototype.GetterByBindingType=[Me.prototype._getValue_direct,Me.prototype._getValue_array,Me.prototype._getValue_arrayElement,Me.prototype._getValue_toArray];Me.prototype.SetterByBindingTypeAndVersioning=[[Me.prototype._setValue_direct,Me.prototype._setValue_direct_setNeedsUpdate,Me.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[Me.prototype._setValue_array,Me.prototype._setValue_array_setNeedsUpdate,Me.prototype._setValue_array_setMatrixWorldNeedsUpdate],[Me.prototype._setValue_arrayElement,Me.prototype._setValue_arrayElement_setNeedsUpdate,Me.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[Me.prototype._setValue_fromArray,Me.prototype._setValue_fromArray_setNeedsUpdate,Me.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var D_=new Float32Array(1);var Mh=new ve,vr=class{constructor(t,e,n=0,s=1/0){this.ray=new _s(t,e),this.near=n,this.far=s,this.camera=null,this.layers=new ms,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(t,e){this.ray.set(t,e)}setFromCamera(t,e){e.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(t.x,t.y,.5).unproject(e).sub(this.ray.origin).normalize(),this.camera=e):e.isOrthographicCamera?(this.ray.origin.set(t.x,t.y,e.projectionMatrix.elements[14]).unproject(e),this.ray.direction.set(0,0,-1).transformDirection(e.matrixWorld),this.camera=e):Ht("Raycaster: Unsupported camera type: "+e.type)}setFromXRController(t){return Mh.identity().extractRotation(t.matrixWorld),this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(Mh),this}intersectObject(t,e=!0,n=[]){return Ol(t,this,n,e),n.sort(Sh),n}intersectObjects(t,e=!0,n=[]){for(let s=0,r=t.length;s<r;s++)Ol(t[s],this,n,e);return n.sort(Sh),n}};function Sh(i,t){return i.distance-t.distance}function Ol(i,t,e,n){let s=!0;if(i.layers.test(t.layers)&&i.raycast(t,e)===!1&&(s=!1),s===!0&&n===!0){let r=i.children;for(let a=0,o=r.length;a<o;a++)Ol(r[a],t,e,!0)}}var mc=class mc{constructor(t,e,n,s){this.elements=[1,0,0,1],t!==void 0&&this.set(t,e,n,s)}identity(){return this.set(1,0,0,1),this}fromArray(t,e=0){for(let n=0;n<4;n++)this.elements[n]=t[n+e];return this}set(t,e,n,s){let r=this.elements;return r[0]=t,r[2]=e,r[1]=n,r[3]=s,this}};mc.prototype.isMatrix2=!0;var Bl=mc;function hc(i,t,e,n){let s=Sf(n);switch(e){case ec:return i*t;case ic:return i*t/s.components*s.byteLength;case Ka:return i*t/s.components*s.byteLength;case Ai:return i*t*2/s.components*s.byteLength;case Ja:return i*t*2/s.components*s.byteLength;case nc:return i*t*3/s.components*s.byteLength;case Mn:return i*t*4/s.components*s.byteLength;case $a:return i*t*4/s.components*s.byteLength;case br:case Tr:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case Er:case wr:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case ja:case eo:return Math.max(i,16)*Math.max(t,8)/4;case Qa:case to:return Math.max(i,8)*Math.max(t,8)/2;case no:case io:case ro:case ao:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case so:case Ar:case oo:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case lo:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case co:return Math.floor((i+4)/5)*Math.floor((t+3)/4)*16;case ho:return Math.floor((i+4)/5)*Math.floor((t+4)/5)*16;case uo:return Math.floor((i+5)/6)*Math.floor((t+4)/5)*16;case fo:return Math.floor((i+5)/6)*Math.floor((t+5)/6)*16;case po:return Math.floor((i+7)/8)*Math.floor((t+4)/5)*16;case mo:return Math.floor((i+7)/8)*Math.floor((t+5)/6)*16;case go:return Math.floor((i+7)/8)*Math.floor((t+7)/8)*16;case _o:return Math.floor((i+9)/10)*Math.floor((t+4)/5)*16;case xo:return Math.floor((i+9)/10)*Math.floor((t+5)/6)*16;case vo:return Math.floor((i+9)/10)*Math.floor((t+7)/8)*16;case yo:return Math.floor((i+9)/10)*Math.floor((t+9)/10)*16;case Mo:return Math.floor((i+11)/12)*Math.floor((t+9)/10)*16;case So:return Math.floor((i+11)/12)*Math.floor((t+11)/12)*16;case bo:case To:case Eo:return Math.ceil(i/4)*Math.ceil(t/4)*16;case wo:case Ao:return Math.ceil(i/4)*Math.ceil(t/4)*8;case Rr:case Ro:return Math.ceil(i/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${e} format.`)}function Sf(i){switch(i){case on:case $l:return{byteLength:1,components:1};case ws:case Ql:case Hn:return{byteLength:2,components:1};case Ya:case Za:return{byteLength:2,components:4};case Pn:case qa:case In:return{byteLength:4,components:1};case jl:case tc:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${i}.`)}typeof __THREE_DEVTOOLS__!="undefined"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"185"}}));typeof window!="undefined"&&(window.__THREE__?Gt("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="185");function Nu(){let i=null,t=!1,e=null,n=null;function s(r,a){e(r,a),n=i.requestAnimationFrame(s)}return{start:function(){t!==!0&&e!==null&&i!==null&&(n=i.requestAnimationFrame(s),t=!0)},stop:function(){i!==null&&i.cancelAnimationFrame(n),t=!1},setAnimationLoop:function(r){e=r},setContext:function(r){i=r}}}function Tf(i){let t=new WeakMap;function e(o,l){let c=o.array,h=o.usage,d=c.byteLength,u=i.createBuffer();i.bindBuffer(l,u),i.bufferData(l,c,h),o.onUploadCallback();let f;if(c instanceof Float32Array)f=i.FLOAT;else if(typeof Float16Array!="undefined"&&c instanceof Float16Array)f=i.HALF_FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?f=i.HALF_FLOAT:f=i.UNSIGNED_SHORT;else if(c instanceof Int16Array)f=i.SHORT;else if(c instanceof Uint32Array)f=i.UNSIGNED_INT;else if(c instanceof Int32Array)f=i.INT;else if(c instanceof Int8Array)f=i.BYTE;else if(c instanceof Uint8Array)f=i.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)f=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:u,type:f,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:d}}function n(o,l,c){let h=l.array,d=l.updateRanges;if(i.bindBuffer(c,o),d.length===0)i.bufferSubData(c,0,h);else{d.sort((f,m)=>f.start-m.start);let u=0;for(let f=1;f<d.length;f++){let m=d[u],y=d[f];y.start<=m.start+m.count+1?m.count=Math.max(m.count,y.start+y.count-m.start):(++u,d[u]=y)}d.length=u+1;for(let f=0,m=d.length;f<m;f++){let y=d[f];i.bufferSubData(c,y.start*h.BYTES_PER_ELEMENT,h,y.start,y.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(o){return o.isInterleavedBufferAttribute&&(o=o.data),t.get(o)}function r(o){o.isInterleavedBufferAttribute&&(o=o.data);let l=t.get(o);l&&(i.deleteBuffer(l.buffer),t.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){let h=t.get(o);(!h||h.version<o.version)&&t.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}let c=t.get(o);if(c===void 0)t.set(o,e(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,o,l),c.version=o.version}}return{get:s,remove:r,update:a}}var Ef=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,wf=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,Af=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Rf=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Cf=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Pf=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,If=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Lf=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Df=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,Nf=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Uf=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Ff=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Of=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Bf=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,zf=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,kf=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,Vf=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Hf=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Gf=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Wf=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Xf=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,qf=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Yf=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,Zf=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Kf=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Jf=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,$f=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Qf=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,jf=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,tp=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,ep="gl_FragColor = linearToOutputTexel( gl_FragColor );",np=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,ip=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,sp=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,rp=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,ap=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,op=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,lp=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,cp=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,hp=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,up=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,dp=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,fp=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,pp=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,mp=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,gp=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,_p=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,xp=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,vp=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,yp=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Mp=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Sp=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,bp=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
		vec3 iridescenceFresnelDielectric;
		vec3 iridescenceFresnelMetallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
vec3 BRDF_GGX_Multiscatter( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 singleScatter = BRDF_GGX( lightDir, viewDir, normal, material );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 dfgV = texture2D( dfgLUT, vec2( material.roughness, dotNV ) ).rg;
	vec2 dfgL = texture2D( dfgLUT, vec2( material.roughness, dotNL ) ).rg;
	vec3 FssEss_V = material.specularColorBlended * dfgV.x + material.specularF90 * dfgV.y;
	vec3 FssEss_L = material.specularColorBlended * dfgL.x + material.specularF90 * dfgL.y;
	float Ess_V = dfgV.x + dfgV.y;
	float Ess_L = dfgL.x + dfgL.y;
	float Ems_V = 1.0 - Ess_V;
	float Ems_L = 1.0 - Ess_L;
	vec3 Favg = material.specularColorBlended + ( 1.0 - material.specularColorBlended ) * 0.047619;
	vec3 Fms = FssEss_V * FssEss_L * Favg / ( 1.0 - Ems_V * Ems_L * Favg + EPSILON );
	float compensationFactor = Ems_V * Ems_L;
	vec3 multiScatter = Fms * compensationFactor;
	return singleScatter + multiScatter;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX_Multiscatter( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnelDielectric, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceFresnelMetallic, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Tp=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( material.iridescenceFresnelDielectric, material.iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Ep=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,wp=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Ap=`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,Rp=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Cp=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Pp=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Ip=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Lp=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Dp=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Np=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Up=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Fp=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Op=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Bp=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,zp=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,kp=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Vp=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,Hp=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Gp=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Wp=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Xp=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,qp=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Yp=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,Zp=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Kp=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Jp=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,$p=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Qp=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,jp=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,tm=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,em=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,nm=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,im=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,sm=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,rm=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,am=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,om=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,lm=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,cm=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,hm=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,um=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,dm=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,fm=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,pm=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,mm=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,gm=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,_m=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,xm=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,vm=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,ym=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,Mm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Sm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,bm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,Tm=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,Em=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,wm=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Am=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Rm=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Cm=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Pm=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Im=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,Lm=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,Dm=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,Nm=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,Um=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Fm=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Om=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Bm=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,zm=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,km=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Vm=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Hm=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Gm=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Wm=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Xm=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,qm=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Ym=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Zm=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Km=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,Jm=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,$m=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Qm=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,jm=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,t0=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,e0=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,n0=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,i0=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,s0=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,jt={alphahash_fragment:Ef,alphahash_pars_fragment:wf,alphamap_fragment:Af,alphamap_pars_fragment:Rf,alphatest_fragment:Cf,alphatest_pars_fragment:Pf,aomap_fragment:If,aomap_pars_fragment:Lf,batching_pars_vertex:Df,batching_vertex:Nf,begin_vertex:Uf,beginnormal_vertex:Ff,bsdfs:Of,iridescence_fragment:Bf,bumpmap_pars_fragment:zf,clipping_planes_fragment:kf,clipping_planes_pars_fragment:Vf,clipping_planes_pars_vertex:Hf,clipping_planes_vertex:Gf,color_fragment:Wf,color_pars_fragment:Xf,color_pars_vertex:qf,color_vertex:Yf,common:Zf,cube_uv_reflection_fragment:Kf,defaultnormal_vertex:Jf,displacementmap_pars_vertex:$f,displacementmap_vertex:Qf,emissivemap_fragment:jf,emissivemap_pars_fragment:tp,colorspace_fragment:ep,colorspace_pars_fragment:np,envmap_fragment:ip,envmap_common_pars_fragment:sp,envmap_pars_fragment:rp,envmap_pars_vertex:ap,envmap_physical_pars_fragment:_p,envmap_vertex:op,fog_vertex:lp,fog_pars_vertex:cp,fog_fragment:hp,fog_pars_fragment:up,gradientmap_pars_fragment:dp,lightmap_pars_fragment:fp,lights_lambert_fragment:pp,lights_lambert_pars_fragment:mp,lights_pars_begin:gp,lights_toon_fragment:xp,lights_toon_pars_fragment:vp,lights_phong_fragment:yp,lights_phong_pars_fragment:Mp,lights_physical_fragment:Sp,lights_physical_pars_fragment:bp,lights_fragment_begin:Tp,lights_fragment_maps:Ep,lights_fragment_end:wp,lightprobes_pars_fragment:Ap,logdepthbuf_fragment:Rp,logdepthbuf_pars_fragment:Cp,logdepthbuf_pars_vertex:Pp,logdepthbuf_vertex:Ip,map_fragment:Lp,map_pars_fragment:Dp,map_particle_fragment:Np,map_particle_pars_fragment:Up,metalnessmap_fragment:Fp,metalnessmap_pars_fragment:Op,morphinstance_vertex:Bp,morphcolor_vertex:zp,morphnormal_vertex:kp,morphtarget_pars_vertex:Vp,morphtarget_vertex:Hp,normal_fragment_begin:Gp,normal_fragment_maps:Wp,normal_pars_fragment:Xp,normal_pars_vertex:qp,normal_vertex:Yp,normalmap_pars_fragment:Zp,clearcoat_normal_fragment_begin:Kp,clearcoat_normal_fragment_maps:Jp,clearcoat_pars_fragment:$p,iridescence_pars_fragment:Qp,opaque_fragment:jp,packing:tm,premultiplied_alpha_fragment:em,project_vertex:nm,dithering_fragment:im,dithering_pars_fragment:sm,roughnessmap_fragment:rm,roughnessmap_pars_fragment:am,shadowmap_pars_fragment:om,shadowmap_pars_vertex:lm,shadowmap_vertex:cm,shadowmask_pars_fragment:hm,skinbase_vertex:um,skinning_pars_vertex:dm,skinning_vertex:fm,skinnormal_vertex:pm,specularmap_fragment:mm,specularmap_pars_fragment:gm,tonemapping_fragment:_m,tonemapping_pars_fragment:xm,transmission_fragment:vm,transmission_pars_fragment:ym,uv_pars_fragment:Mm,uv_pars_vertex:Sm,uv_vertex:bm,worldpos_vertex:Tm,background_vert:Em,background_frag:wm,backgroundCube_vert:Am,backgroundCube_frag:Rm,cube_vert:Cm,cube_frag:Pm,depth_vert:Im,depth_frag:Lm,distance_vert:Dm,distance_frag:Nm,equirect_vert:Um,equirect_frag:Fm,linedashed_vert:Om,linedashed_frag:Bm,meshbasic_vert:zm,meshbasic_frag:km,meshlambert_vert:Vm,meshlambert_frag:Hm,meshmatcap_vert:Gm,meshmatcap_frag:Wm,meshnormal_vert:Xm,meshnormal_frag:qm,meshphong_vert:Ym,meshphong_frag:Zm,meshphysical_vert:Km,meshphysical_frag:Jm,meshtoon_vert:$m,meshtoon_frag:Qm,points_vert:jm,points_frag:t0,shadow_vert:e0,shadow_frag:n0,sprite_vert:i0,sprite_frag:s0},yt={common:{diffuse:{value:new Yt(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new qt},alphaMap:{value:null},alphaMapTransform:{value:new qt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new qt}},envmap:{envMap:{value:null},envMapRotation:{value:new qt},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new qt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new qt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new qt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new qt},normalScale:{value:new ht(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new qt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new qt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new qt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new qt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Yt(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new I},probesMax:{value:new I},probesResolution:{value:new I}},points:{diffuse:{value:new Yt(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new qt},alphaTest:{value:0},uvTransform:{value:new qt}},sprite:{diffuse:{value:new Yt(16777215)},opacity:{value:1},center:{value:new ht(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new qt},alphaMap:{value:null},alphaMapTransform:{value:new qt},alphaTest:{value:0}}},Wn={basic:{uniforms:Qe([yt.common,yt.specularmap,yt.envmap,yt.aomap,yt.lightmap,yt.fog]),vertexShader:jt.meshbasic_vert,fragmentShader:jt.meshbasic_frag},lambert:{uniforms:Qe([yt.common,yt.specularmap,yt.envmap,yt.aomap,yt.lightmap,yt.emissivemap,yt.bumpmap,yt.normalmap,yt.displacementmap,yt.fog,yt.lights,{emissive:{value:new Yt(0)},envMapIntensity:{value:1}}]),vertexShader:jt.meshlambert_vert,fragmentShader:jt.meshlambert_frag},phong:{uniforms:Qe([yt.common,yt.specularmap,yt.envmap,yt.aomap,yt.lightmap,yt.emissivemap,yt.bumpmap,yt.normalmap,yt.displacementmap,yt.fog,yt.lights,{emissive:{value:new Yt(0)},specular:{value:new Yt(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:jt.meshphong_vert,fragmentShader:jt.meshphong_frag},standard:{uniforms:Qe([yt.common,yt.envmap,yt.aomap,yt.lightmap,yt.emissivemap,yt.bumpmap,yt.normalmap,yt.displacementmap,yt.roughnessmap,yt.metalnessmap,yt.fog,yt.lights,{emissive:{value:new Yt(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:jt.meshphysical_vert,fragmentShader:jt.meshphysical_frag},toon:{uniforms:Qe([yt.common,yt.aomap,yt.lightmap,yt.emissivemap,yt.bumpmap,yt.normalmap,yt.displacementmap,yt.gradientmap,yt.fog,yt.lights,{emissive:{value:new Yt(0)}}]),vertexShader:jt.meshtoon_vert,fragmentShader:jt.meshtoon_frag},matcap:{uniforms:Qe([yt.common,yt.bumpmap,yt.normalmap,yt.displacementmap,yt.fog,{matcap:{value:null}}]),vertexShader:jt.meshmatcap_vert,fragmentShader:jt.meshmatcap_frag},points:{uniforms:Qe([yt.points,yt.fog]),vertexShader:jt.points_vert,fragmentShader:jt.points_frag},dashed:{uniforms:Qe([yt.common,yt.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:jt.linedashed_vert,fragmentShader:jt.linedashed_frag},depth:{uniforms:Qe([yt.common,yt.displacementmap]),vertexShader:jt.depth_vert,fragmentShader:jt.depth_frag},normal:{uniforms:Qe([yt.common,yt.bumpmap,yt.normalmap,yt.displacementmap,{opacity:{value:1}}]),vertexShader:jt.meshnormal_vert,fragmentShader:jt.meshnormal_frag},sprite:{uniforms:Qe([yt.sprite,yt.fog]),vertexShader:jt.sprite_vert,fragmentShader:jt.sprite_frag},background:{uniforms:{uvTransform:{value:new qt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:jt.background_vert,fragmentShader:jt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new qt}},vertexShader:jt.backgroundCube_vert,fragmentShader:jt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:jt.cube_vert,fragmentShader:jt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:jt.equirect_vert,fragmentShader:jt.equirect_frag},distance:{uniforms:Qe([yt.common,yt.displacementmap,{referencePosition:{value:new I},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:jt.distance_vert,fragmentShader:jt.distance_frag},shadow:{uniforms:Qe([yt.lights,yt.fog,{color:{value:new Yt(0)},opacity:{value:1}}]),vertexShader:jt.shadow_vert,fragmentShader:jt.shadow_frag}};Wn.physical={uniforms:Qe([Wn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new qt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new qt},clearcoatNormalScale:{value:new ht(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new qt},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new qt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new qt},sheen:{value:0},sheenColor:{value:new Yt(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new qt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new qt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new qt},transmissionSamplerSize:{value:new ht},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new qt},attenuationDistance:{value:0},attenuationColor:{value:new Yt(0)},specularColor:{value:new Yt(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new qt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new qt},anisotropyVector:{value:new ht},anisotropyMap:{value:null},anisotropyMapTransform:{value:new qt}}]),vertexShader:jt.meshphysical_vert,fragmentShader:jt.meshphysical_frag};var Lo={r:0,b:0,g:0},r0=new ve,Uu=new qt;Uu.set(-1,0,0,0,1,0,0,0,1);function a0(i,t,e,n,s,r){let a=new Yt(0),o=s===!0?0:1,l,c,h=null,d=0,u=null;function f(S){let b=S.isScene===!0?S.background:null;if(b&&b.isTexture){let v=S.backgroundBlurriness>0;b=t.get(b,v)}return b}function m(S){let b=!1,v=f(S);v===null?p(a,o):v&&v.isColor&&(p(v,1),b=!0);let w=i.xr.getEnvironmentBlendMode();w==="additive"?e.buffers.color.setClear(0,0,0,1,r):w==="alpha-blend"&&e.buffers.color.setClear(0,0,0,0,r),(i.autoClear||b)&&(e.buffers.depth.setTest(!0),e.buffers.depth.setMask(!0),e.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function y(S,b){let v=f(b);v&&(v.isCubeTexture||v.mapping===Mr)?(c===void 0&&(c=new Tt(new vs(1,1,1),new sn({name:"BackgroundCubeMaterial",uniforms:Xi(Wn.backgroundCube.uniforms),vertexShader:Wn.backgroundCube.vertexShader,fragmentShader:Wn.backgroundCube.fragmentShader,side:rn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(w,T,R){this.matrixWorld.copyPosition(R.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),n.update(c)),c.material.uniforms.envMap.value=v,c.material.uniforms.backgroundBlurriness.value=b.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=b.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(r0.makeRotationFromEuler(b.backgroundRotation)).transpose(),v.isCubeTexture&&v.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(Uu),c.material.toneMapped=se.getTransfer(v.colorSpace)!==de,(h!==v||d!==v.version||u!==i.toneMapping)&&(c.material.needsUpdate=!0,h=v,d=v.version,u=i.toneMapping),c.layers.enableAll(),S.unshift(c,c.geometry,c.material,0,0,null)):v&&v.isTexture&&(l===void 0&&(l=new Tt(new $e(2,2),new sn({name:"BackgroundMaterial",uniforms:Xi(Wn.background.uniforms),vertexShader:Wn.background.vertexShader,fragmentShader:Wn.background.fragmentShader,side:Qn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),n.update(l)),l.material.uniforms.t2D.value=v,l.material.uniforms.backgroundIntensity.value=b.backgroundIntensity,l.material.toneMapped=se.getTransfer(v.colorSpace)!==de,v.matrixAutoUpdate===!0&&v.updateMatrix(),l.material.uniforms.uvTransform.value.copy(v.matrix),(h!==v||d!==v.version||u!==i.toneMapping)&&(l.material.needsUpdate=!0,h=v,d=v.version,u=i.toneMapping),l.layers.enableAll(),S.unshift(l,l.geometry,l.material,0,0,null))}function p(S,b){S.getRGB(Lo,oc(i)),e.buffers.color.setClear(Lo.r,Lo.g,Lo.b,b,r)}function g(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return a},setClearColor:function(S,b=1){a.set(S),o=b,p(a,o)},getClearAlpha:function(){return o},setClearAlpha:function(S){o=S,p(a,o)},render:m,addToRenderList:y,dispose:g}}function o0(i,t){let e=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=u(null),r=s,a=!1;function o(C,D,W,X,O){let H=!1,V=d(C,X,W,D);r!==V&&(r=V,c(r.object)),H=f(C,X,W,O),H&&m(C,X,W,O),O!==null&&t.update(O,i.ELEMENT_ARRAY_BUFFER),(H||a)&&(a=!1,v(C,D,W,X),O!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,t.get(O).buffer))}function l(){return i.createVertexArray()}function c(C){return i.bindVertexArray(C)}function h(C){return i.deleteVertexArray(C)}function d(C,D,W,X){let O=X.wireframe===!0,H=n[D.id];H===void 0&&(H={},n[D.id]=H);let V=C.isInstancedMesh===!0?C.id:0,K=H[V];K===void 0&&(K={},H[V]=K);let et=K[W.id];et===void 0&&(et={},K[W.id]=et);let ot=et[O];return ot===void 0&&(ot=u(l()),et[O]=ot),ot}function u(C){let D=[],W=[],X=[];for(let O=0;O<e;O++)D[O]=0,W[O]=0,X[O]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:D,enabledAttributes:W,attributeDivisors:X,object:C,attributes:{},index:null}}function f(C,D,W,X){let O=r.attributes,H=D.attributes,V=0,K=W.getAttributes();for(let et in K)if(K[et].location>=0){let ct=O[et],it=H[et];if(it===void 0&&(et==="instanceMatrix"&&C.instanceMatrix&&(it=C.instanceMatrix),et==="instanceColor"&&C.instanceColor&&(it=C.instanceColor)),ct===void 0||ct.attribute!==it||it&&ct.data!==it.data)return!0;V++}return r.attributesNum!==V||r.index!==X}function m(C,D,W,X){let O={},H=D.attributes,V=0,K=W.getAttributes();for(let et in K)if(K[et].location>=0){let ct=H[et];ct===void 0&&(et==="instanceMatrix"&&C.instanceMatrix&&(ct=C.instanceMatrix),et==="instanceColor"&&C.instanceColor&&(ct=C.instanceColor));let it={};it.attribute=ct,ct&&ct.data&&(it.data=ct.data),O[et]=it,V++}r.attributes=O,r.attributesNum=V,r.index=X}function y(){let C=r.newAttributes;for(let D=0,W=C.length;D<W;D++)C[D]=0}function p(C){g(C,0)}function g(C,D){let W=r.newAttributes,X=r.enabledAttributes,O=r.attributeDivisors;W[C]=1,X[C]===0&&(i.enableVertexAttribArray(C),X[C]=1),O[C]!==D&&(i.vertexAttribDivisor(C,D),O[C]=D)}function S(){let C=r.newAttributes,D=r.enabledAttributes;for(let W=0,X=D.length;W<X;W++)D[W]!==C[W]&&(i.disableVertexAttribArray(W),D[W]=0)}function b(C,D,W,X,O,H,V){V===!0?i.vertexAttribIPointer(C,D,W,O,H):i.vertexAttribPointer(C,D,W,X,O,H)}function v(C,D,W,X){y();let O=X.attributes,H=W.getAttributes(),V=D.defaultAttributeValues;for(let K in H){let et=H[K];if(et.location>=0){let ot=O[K];if(ot===void 0&&(K==="instanceMatrix"&&C.instanceMatrix&&(ot=C.instanceMatrix),K==="instanceColor"&&C.instanceColor&&(ot=C.instanceColor)),ot!==void 0){let ct=ot.normalized,it=ot.itemSize,zt=t.get(ot);if(zt===void 0)continue;let $t=zt.buffer,Zt=zt.type,Z=zt.bytesPerElement,at=Zt===i.INT||Zt===i.UNSIGNED_INT||ot.gpuType===qa;if(ot.isInterleavedBufferAttribute){let tt=ot.data,pt=tt.stride,Ft=ot.offset;if(tt.isInstancedInterleavedBuffer){for(let Pt=0;Pt<et.locationSize;Pt++)g(et.location+Pt,tt.meshPerAttribute);C.isInstancedMesh!==!0&&X._maxInstanceCount===void 0&&(X._maxInstanceCount=tt.meshPerAttribute*tt.count)}else for(let Pt=0;Pt<et.locationSize;Pt++)p(et.location+Pt);i.bindBuffer(i.ARRAY_BUFFER,$t);for(let Pt=0;Pt<et.locationSize;Pt++)b(et.location+Pt,it/et.locationSize,Zt,ct,pt*Z,(Ft+it/et.locationSize*Pt)*Z,at)}else{if(ot.isInstancedBufferAttribute){for(let tt=0;tt<et.locationSize;tt++)g(et.location+tt,ot.meshPerAttribute);C.isInstancedMesh!==!0&&X._maxInstanceCount===void 0&&(X._maxInstanceCount=ot.meshPerAttribute*ot.count)}else for(let tt=0;tt<et.locationSize;tt++)p(et.location+tt);i.bindBuffer(i.ARRAY_BUFFER,$t);for(let tt=0;tt<et.locationSize;tt++)b(et.location+tt,it/et.locationSize,Zt,ct,it*Z,it/et.locationSize*tt*Z,at)}}else if(V!==void 0){let ct=V[K];if(ct!==void 0)switch(ct.length){case 2:i.vertexAttrib2fv(et.location,ct);break;case 3:i.vertexAttrib3fv(et.location,ct);break;case 4:i.vertexAttrib4fv(et.location,ct);break;default:i.vertexAttrib1fv(et.location,ct)}}}}S()}function w(){E();for(let C in n){let D=n[C];for(let W in D){let X=D[W];for(let O in X){let H=X[O];for(let V in H)h(H[V].object),delete H[V];delete X[O]}}delete n[C]}}function T(C){if(n[C.id]===void 0)return;let D=n[C.id];for(let W in D){let X=D[W];for(let O in X){let H=X[O];for(let V in H)h(H[V].object),delete H[V];delete X[O]}}delete n[C.id]}function R(C){for(let D in n){let W=n[D];for(let X in W){let O=W[X];if(O[C.id]===void 0)continue;let H=O[C.id];for(let V in H)h(H[V].object),delete H[V];delete O[C.id]}}}function _(C){for(let D in n){let W=n[D],X=C.isInstancedMesh===!0?C.id:0,O=W[X];if(O!==void 0){for(let H in O){let V=O[H];for(let K in V)h(V[K].object),delete V[K];delete O[H]}delete W[X],Object.keys(W).length===0&&delete n[D]}}}function E(){P(),a=!0,r!==s&&(r=s,c(r.object))}function P(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:o,reset:E,resetDefaultState:P,dispose:w,releaseStatesOfGeometry:T,releaseStatesOfObject:_,releaseStatesOfProgram:R,initAttributes:y,enableAttribute:p,disableUnusedAttributes:S}}function l0(i,t,e){let n;function s(l){n=l}function r(l,c){i.drawArrays(n,l,c),e.update(c,n,1)}function a(l,c,h){h!==0&&(i.drawArraysInstanced(n,l,c,h),e.update(c,n,h))}function o(l,c,h){if(h===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,l,0,c,0,h);let u=0;for(let f=0;f<h;f++)u+=c[f];e.update(u,n,1)}this.setMode=s,this.render=r,this.renderInstances=a,this.renderMultiDraw=o}function c0(i,t,e,n){let s;function r(){if(s!==void 0)return s;if(t.has("EXT_texture_filter_anisotropic")===!0){let R=t.get("EXT_texture_filter_anisotropic");s=i.getParameter(R.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function a(R){return!(R!==Mn&&n.convert(R)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(R){let _=R===Hn&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(R!==on&&n.convert(R)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE)&&R!==In&&!_)}function l(R){if(R==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";R="mediump"}return R==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=e.precision!==void 0?e.precision:"highp",h=l(c);h!==c&&(Gt("WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);let d=e.logarithmicDepthBuffer===!0,u=e.reversedDepthBuffer===!0&&t.has("EXT_clip_control");e.reversedDepthBuffer===!0&&u===!1&&Gt("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let f=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),m=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),y=i.getParameter(i.MAX_TEXTURE_SIZE),p=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),g=i.getParameter(i.MAX_VERTEX_ATTRIBS),S=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),b=i.getParameter(i.MAX_VARYING_VECTORS),v=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),w=i.getParameter(i.MAX_SAMPLES),T=i.getParameter(i.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:d,reversedDepthBuffer:u,maxTextures:f,maxVertexTextures:m,maxTextureSize:y,maxCubemapSize:p,maxAttributes:g,maxVertexUniforms:S,maxVaryings:b,maxFragmentUniforms:v,maxSamples:w,samples:T}}function h0(i){let t=this,e=null,n=0,s=!1,r=!1,a=new vn,o=new qt,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(d,u){let f=d.length!==0||u||n!==0||s;return s=u,n=d.length,f},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(d,u){e=h(d,u,0)},this.setState=function(d,u,f){let m=d.clippingPlanes,y=d.clipIntersection,p=d.clipShadows,g=i.get(d);if(!s||m===null||m.length===0||r&&!p)r?h(null):c();else{let S=r?0:n,b=S*4,v=g.clippingState||null;l.value=v,v=h(m,u,b,f);for(let w=0;w!==b;++w)v[w]=e[w];g.clippingState=v,this.numIntersection=y?this.numPlanes:0,this.numPlanes+=S}};function c(){l.value!==e&&(l.value=e,l.needsUpdate=n>0),t.numPlanes=n,t.numIntersection=0}function h(d,u,f,m){let y=d!==null?d.length:0,p=null;if(y!==0){if(p=l.value,m!==!0||p===null){let g=f+y*4,S=u.matrixWorldInverse;o.getNormalMatrix(S),(p===null||p.length<g)&&(p=new Float32Array(g));for(let b=0,v=f;b!==y;++b,v+=4)a.copy(d[b]).applyMatrix4(S,o),a.normal.toArray(p,v),p[v+3]=a.constant}l.value=p,l.needsUpdate=!0}return t.numPlanes=y,t.numIntersection=0,p}}var Ri=4,du=[.125,.215,.35,.446,.526,.582],qi=20,u0=256,Cr=new bs,fu=new Yt,gc=null,_c=0,xc=0,vc=!1,d0=new I,Is=class{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(t,e=0,n=.1,s=100,r={}){let{size:a=256,position:o=d0}=r;gc=this._renderer.getRenderTarget(),_c=this._renderer.getActiveCubeFace(),xc=this._renderer.getActiveMipmapLevel(),vc=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);let l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(t,n,s,l,o),e>0&&this._blur(l,0,0,e),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=gu(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=mu(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodMeshes.length;t++)this._lodMeshes[t].geometry.dispose()}_cleanup(t){this._renderer.setRenderTarget(gc,_c,xc),this._renderer.xr.enabled=vc,t.scissorTest=!1,Cs(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===Ti||t.mapping===Wi?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),gc=this._renderer.getRenderTarget(),_c=this._renderer.getActiveCubeFace(),xc=this._renderer.getActiveMipmapLevel(),vc=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=e||this._allocateTargets();return this._textureToCubeUV(t,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,n={magFilter:Xe,minFilter:Xe,generateMipmaps:!1,type:Hn,format:Mn,colorSpace:Ys,depthBuffer:!1},s=pu(t,e,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=pu(t,e,n);let{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=f0(r)),this._blurMaterial=m0(r,t,e),this._ggxMaterial=p0(r,t,e)}return s}_compileMaterial(t){let e=new Tt(new Ue,t);this._renderer.compile(e,Cr)}_sceneToCubeUV(t,e,n,s,r){let l=new ze(90,1,e,n),c=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],d=this._renderer,u=d.autoClear,f=d.toneMapping;d.getClearColor(fu),d.toneMapping=Cn,d.autoClear=!1,d.state.buffers.depth.getReversed()&&(d.setRenderTarget(s),d.clearDepth(),d.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new Tt(new vs,new ii({name:"PMREM.Background",side:rn,depthWrite:!1,depthTest:!1})));let y=this._backgroundBox,p=y.material,g=!1,S=t.background;S?S.isColor&&(p.color.copy(S),t.background=null,g=!0):(p.color.copy(fu),g=!0);for(let b=0;b<6;b++){let v=b%3;v===0?(l.up.set(0,c[b],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x+h[b],r.y,r.z)):v===1?(l.up.set(0,0,c[b]),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y+h[b],r.z)):(l.up.set(0,c[b],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y,r.z+h[b]));let w=this._cubeSize;Cs(s,v*w,b>2?w:0,w,w),d.setRenderTarget(s),g&&d.render(y,l),d.render(t,l)}d.toneMapping=f,d.autoClear=u,t.background=S}_textureToCubeUV(t,e){let n=this._renderer,s=t.mapping===Ti||t.mapping===Wi;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=gu()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=mu());let r=s?this._cubemapMaterial:this._equirectMaterial,a=this._lodMeshes[0];a.material=r;let o=r.uniforms;o.envMap.value=t;let l=this._cubeSize;Cs(e,0,0,3*l,2*l),n.setRenderTarget(e),n.render(a,Cr)}_applyPMREM(t){let e=this._renderer,n=e.autoClear;e.autoClear=!1;let s=this._lodMeshes.length;for(let r=1;r<s;r++)this._applyGGXFilter(t,r-1,r);e.autoClear=n}_applyGGXFilter(t,e,n){let s=this._renderer,r=this._pingPongRenderTarget,a=this._ggxMaterial,o=this._lodMeshes[n];o.material=a;let l=a.uniforms,c=n/(this._lodMeshes.length-1),h=e/(this._lodMeshes.length-1),d=Math.sqrt(c*c-h*h),u=0+c*1.25,f=d*u,{_lodMax:m}=this,y=this._sizeLods[n],p=3*y*(n>m-Ri?n-m+Ri:0),g=4*(this._cubeSize-y);l.envMap.value=t.texture,l.roughness.value=f,l.mipInt.value=m-e,Cs(r,p,g,3*y,2*y),s.setRenderTarget(r),s.render(o,Cr),l.envMap.value=r.texture,l.roughness.value=0,l.mipInt.value=m-n,Cs(t,p,g,3*y,2*y),s.setRenderTarget(t),s.render(o,Cr)}_blur(t,e,n,s,r){let a=this._pingPongRenderTarget;this._halfBlur(t,a,e,n,s,"latitudinal",r),this._halfBlur(a,t,n,n,s,"longitudinal",r)}_halfBlur(t,e,n,s,r,a,o){let l=this._renderer,c=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&Ht("blur direction must be either latitudinal or longitudinal!");let h=3,d=this._lodMeshes[s];d.material=c;let u=c.uniforms,f=this._sizeLods[n]-1,m=isFinite(r)?Math.PI/(2*f):2*Math.PI/(2*qi-1),y=r/m,p=isFinite(r)?1+Math.floor(h*y):qi;p>qi&&Gt(`sigmaRadians, ${r}, is too large and will clip, as it requested ${p} samples when the maximum is set to ${qi}`);let g=[],S=0;for(let R=0;R<qi;++R){let _=R/y,E=Math.exp(-_*_/2);g.push(E),R===0?S+=E:R<p&&(S+=2*E)}for(let R=0;R<g.length;R++)g[R]=g[R]/S;u.envMap.value=t.texture,u.samples.value=p,u.weights.value=g,u.latitudinal.value=a==="latitudinal",o&&(u.poleAxis.value=o);let{_lodMax:b}=this;u.dTheta.value=m,u.mipInt.value=b-n;let v=this._sizeLods[s],w=3*v*(s>b-Ri?s-b+Ri:0),T=4*(this._cubeSize-v);Cs(e,w,T,3*v,2*v),l.setRenderTarget(e),l.render(d,Cr)}};function f0(i){let t=[],e=[],n=[],s=i,r=i-Ri+1+du.length;for(let a=0;a<r;a++){let o=Math.pow(2,s);t.push(o);let l=1/o;a>i-Ri?l=du[a-i+Ri-1]:a===0&&(l=0),e.push(l);let c=1/(o-2),h=-c,d=1+c,u=[h,h,d,h,d,d,h,h,d,d,h,d],f=6,m=6,y=3,p=2,g=1,S=new Float32Array(y*m*f),b=new Float32Array(p*m*f),v=new Float32Array(g*m*f);for(let T=0;T<f;T++){let R=T%3*2/3-1,_=T>2?0:-1,E=[R,_,0,R+2/3,_,0,R+2/3,_+1,0,R,_,0,R+2/3,_+1,0,R,_+1,0];S.set(E,y*m*T),b.set(u,p*m*T);let P=[T,T,T,T,T,T];v.set(P,g*m*T)}let w=new Ue;w.setAttribute("position",new ye(S,y)),w.setAttribute("uv",new ye(b,p)),w.setAttribute("faceIndex",new ye(v,g)),n.push(new Tt(w,null)),s>Ri&&s--}return{lodMeshes:n,sizeLods:t,sigmas:e}}function pu(i,t,e){let n=new fn(i,t,e);return n.texture.mapping=Mr,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function Cs(i,t,e,n,s){i.viewport.set(t,e,n,s),i.scissor.set(t,e,n,s)}function p0(i,t,e){return new sn({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:u0,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:Fo(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:Vn,depthTest:!1,depthWrite:!1})}function m0(i,t,e){let n=new Float32Array(qi),s=new I(0,1,0);return new sn({name:"SphericalGaussianBlur",defines:{n:qi,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:Fo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:Vn,depthTest:!1,depthWrite:!1})}function mu(){return new sn({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Fo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Vn,depthTest:!1,depthWrite:!1})}function gu(){return new sn({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Fo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Vn,depthTest:!1,depthWrite:!1})}function Fo(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}var No=class extends fn{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;let n={width:t,height:t,depth:1},s=[n,n,n,n,n,n];this.texture=new ir(s),this._setTextureOptions(e),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},s=new vs(5,5,5),r=new sn({name:"CubemapFromEquirect",uniforms:Xi(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:rn,blending:Vn});r.uniforms.tEquirect.value=e;let a=new Tt(s,r),o=e.minFilter;return e.minFilter===Ei&&(e.minFilter=Xe),new Va(1,10,this).update(t,a),e.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(t,e=!0,n=!0,s=!0){let r=t.getRenderTarget();for(let a=0;a<6;a++)t.setRenderTarget(this,a),t.clear(e,n,s);t.setRenderTarget(r)}};function g0(i){let t=new WeakMap,e=new WeakMap,n=null;function s(u,f=!1){return u==null?null:f?a(u):r(u)}function r(u){if(u&&u.isTexture){let f=u.mapping;if(f===Es||f===Wa)if(t.has(u)){let m=t.get(u).texture;return o(m,u.mapping)}else{let m=u.image;if(m&&m.height>0){let y=new No(m.height);return y.fromEquirectangularTexture(i,u),t.set(u,y),u.addEventListener("dispose",c),o(y.texture,u.mapping)}else return null}}return u}function a(u){if(u&&u.isTexture){let f=u.mapping,m=f===Es||f===Wa,y=f===Ti||f===Wi;if(m||y){let p=e.get(u),g=p!==void 0?p.texture.pmremVersion:0;if(u.isRenderTargetTexture&&u.pmremVersion!==g)return n===null&&(n=new Is(i)),p=m?n.fromEquirectangular(u,p):n.fromCubemap(u,p),p.texture.pmremVersion=u.pmremVersion,e.set(u,p),p.texture;if(p!==void 0)return p.texture;{let S=u.image;return m&&S&&S.height>0||y&&S&&l(S)?(n===null&&(n=new Is(i)),p=m?n.fromEquirectangular(u):n.fromCubemap(u),p.texture.pmremVersion=u.pmremVersion,e.set(u,p),u.addEventListener("dispose",h),p.texture):null}}}return u}function o(u,f){return f===Es?u.mapping=Ti:f===Wa&&(u.mapping=Wi),u}function l(u){let f=0,m=6;for(let y=0;y<m;y++)u[y]!==void 0&&f++;return f===m}function c(u){let f=u.target;f.removeEventListener("dispose",c);let m=t.get(f);m!==void 0&&(t.delete(f),m.dispose())}function h(u){let f=u.target;f.removeEventListener("dispose",h);let m=e.get(f);m!==void 0&&(e.delete(f),m.dispose())}function d(){t=new WeakMap,e=new WeakMap,n!==null&&(n.dispose(),n=null)}return{get:s,dispose:d}}function _0(i){let t={};function e(n){if(t[n]!==void 0)return t[n];let s=i.getExtension(n);return t[n]=s,s}return{has:function(n){return e(n)!==null},init:function(){e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance"),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture"),e("WEBGL_render_shared_exponent")},get:function(n){let s=e(n);return s===null&&Bi("WebGLRenderer: "+n+" extension not supported."),s}}}function x0(i,t,e,n){let s={},r=new WeakMap;function a(d){let u=d.target;u.index!==null&&t.remove(u.index);for(let m in u.attributes)t.remove(u.attributes[m]);u.removeEventListener("dispose",a),delete s[u.id];let f=r.get(u);f&&(t.remove(f),r.delete(u)),n.releaseStatesOfGeometry(u),u.isInstancedBufferGeometry===!0&&delete u._maxInstanceCount,e.memory.geometries--}function o(d,u){return s[u.id]===!0||(u.addEventListener("dispose",a),s[u.id]=!0,e.memory.geometries++),u}function l(d){let u=d.attributes;for(let f in u)t.update(u[f],i.ARRAY_BUFFER)}function c(d){let u=[],f=d.index,m=d.attributes.position,y=0;if(m===void 0)return;if(f!==null){let S=f.array;y=f.version;for(let b=0,v=S.length;b<v;b+=3){let w=S[b+0],T=S[b+1],R=S[b+2];u.push(w,T,T,R,R,w)}}else{let S=m.array;y=m.version;for(let b=0,v=S.length/3-1;b<v;b+=3){let w=b+0,T=b+1,R=b+2;u.push(w,T,T,R,R,w)}}let p=new(m.count>=65535?er:tr)(u,1);p.version=y;let g=r.get(d);g&&t.remove(g),r.set(d,p)}function h(d){let u=r.get(d);if(u){let f=d.index;f!==null&&u.version<f.version&&c(d)}else c(d);return r.get(d)}return{get:o,update:l,getWireframeAttribute:h}}function v0(i,t,e){let n;function s(d){n=d}let r,a;function o(d){r=d.type,a=d.bytesPerElement}function l(d,u){i.drawElements(n,u,r,d*a),e.update(u,n,1)}function c(d,u,f){f!==0&&(i.drawElementsInstanced(n,u,r,d*a,f),e.update(u,n,f))}function h(d,u,f){if(f===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,u,0,r,d,0,f);let y=0;for(let p=0;p<f;p++)y+=u[p];e.update(y,n,1)}this.setMode=s,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=h}function y0(i){let t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,a,o){switch(e.calls++,a){case i.TRIANGLES:e.triangles+=o*(r/3);break;case i.LINES:e.lines+=o*(r/2);break;case i.LINE_STRIP:e.lines+=o*(r-1);break;case i.LINE_LOOP:e.lines+=o*r;break;case i.POINTS:e.points+=o*r;break;default:Ht("WebGLInfo: Unknown draw mode:",a);break}}function s(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:s,update:n}}function M0(i,t,e){let n=new WeakMap,s=new Te;function r(a,o,l){let c=a.morphTargetInfluences,h=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,d=h!==void 0?h.length:0,u=n.get(o);if(u===void 0||u.count!==d){let E=function(){R.dispose(),n.delete(o),o.removeEventListener("dispose",E)};u!==void 0&&u.texture.dispose();let f=o.morphAttributes.position!==void 0,m=o.morphAttributes.normal!==void 0,y=o.morphAttributes.color!==void 0,p=o.morphAttributes.position||[],g=o.morphAttributes.normal||[],S=o.morphAttributes.color||[],b=0;f===!0&&(b=1),m===!0&&(b=2),y===!0&&(b=3);let v=o.attributes.position.count*b,w=1;v>t.maxTextureSize&&(w=Math.ceil(v/t.maxTextureSize),v=t.maxTextureSize);let T=new Float32Array(v*w*4*d),R=new $s(T,v,w,d);R.type=In,R.needsUpdate=!0;let _=b*4;for(let P=0;P<d;P++){let C=p[P],D=g[P],W=S[P],X=v*w*4*P;for(let O=0;O<C.count;O++){let H=O*_;f===!0&&(s.fromBufferAttribute(C,O),T[X+H+0]=s.x,T[X+H+1]=s.y,T[X+H+2]=s.z,T[X+H+3]=0),m===!0&&(s.fromBufferAttribute(D,O),T[X+H+4]=s.x,T[X+H+5]=s.y,T[X+H+6]=s.z,T[X+H+7]=0),y===!0&&(s.fromBufferAttribute(W,O),T[X+H+8]=s.x,T[X+H+9]=s.y,T[X+H+10]=s.z,T[X+H+11]=W.itemSize===4?s.w:1)}}u={count:d,texture:R,size:new ht(v,w)},n.set(o,u),o.addEventListener("dispose",E)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(i,"morphTexture",a.morphTexture,e);else{let f=0;for(let y=0;y<c.length;y++)f+=c[y];let m=o.morphTargetsRelative?1:1-f;l.getUniforms().setValue(i,"morphTargetBaseInfluence",m),l.getUniforms().setValue(i,"morphTargetInfluences",c)}l.getUniforms().setValue(i,"morphTargetsTexture",u.texture,e),l.getUniforms().setValue(i,"morphTargetsTextureSize",u.size)}return{update:r}}function S0(i,t,e,n,s){let r=new WeakMap;function a(c){let h=s.render.frame,d=c.geometry,u=t.get(c,d);if(r.get(u)!==h&&(t.update(u),r.set(u,h)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),r.get(c)!==h&&(e.update(c.instanceMatrix,i.ARRAY_BUFFER),c.instanceColor!==null&&e.update(c.instanceColor,i.ARRAY_BUFFER),r.set(c,h))),c.isSkinnedMesh){let f=c.skeleton;r.get(f)!==h&&(f.update(),r.set(f,h))}return u}function o(){r=new WeakMap}function l(c){let h=c.target;h.removeEventListener("dispose",l),n.releaseStatesOfObject(h),e.remove(h.instanceMatrix),h.instanceColor!==null&&e.remove(h.instanceColor)}return{update:a,dispose:o}}var b0={[Wl]:"LINEAR_TONE_MAPPING",[Xl]:"REINHARD_TONE_MAPPING",[ql]:"CINEON_TONE_MAPPING",[yr]:"ACES_FILMIC_TONE_MAPPING",[Zl]:"AGX_TONE_MAPPING",[Kl]:"NEUTRAL_TONE_MAPPING",[Yl]:"CUSTOM_TONE_MAPPING"};function T0(i,t,e,n,s,r){let a=new fn(t,e,{type:i,depthBuffer:s,stencilBuffer:r,samples:n?4:0,depthTexture:s?new si(t,e):void 0}),o=new fn(t,e,{type:Hn,depthBuffer:!1,stencilBuffer:!1}),l=new Ue;l.setAttribute("position",new we([-1,3,0,-1,-1,0,3,-1,0],3)),l.setAttribute("uv",new we([0,2,0,0,2,0],2));let c=new Ra({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),h=new Tt(l,c),d=new bs(-1,1,1,-1,0,1),u=null,f=null,m=!1,y,p=null,g=[],S=!1;this.setSize=function(b,v){a.setSize(b,v),o.setSize(b,v);for(let w=0;w<g.length;w++){let T=g[w];T.setSize&&T.setSize(b,v)}},this.setEffects=function(b){g=b,S=g.length>0&&g[0].isRenderPass===!0;let v=a.width,w=a.height;for(let T=0;T<g.length;T++){let R=g[T];R.setSize&&R.setSize(v,w)}},this.begin=function(b,v){if(m||b.toneMapping===Cn&&g.length===0)return!1;if(p=v,v!==null){let w=v.width,T=v.height;(a.width!==w||a.height!==T)&&this.setSize(w,T)}return S===!1&&b.setRenderTarget(a),y=b.toneMapping,b.toneMapping=Cn,!0},this.hasRenderPass=function(){return S},this.end=function(b,v){b.toneMapping=y,m=!0;let w=a,T=o;for(let R=0;R<g.length;R++){let _=g[R];if(_.enabled!==!1&&(_.render(b,T,w,v),_.needsSwap!==!1)){let E=w;w=T,T=E}}if(u!==b.outputColorSpace||f!==b.toneMapping){u=b.outputColorSpace,f=b.toneMapping,c.defines={},se.getTransfer(u)===de&&(c.defines.SRGB_TRANSFER="");let R=b0[f];R&&(c.defines[R]=""),c.needsUpdate=!0}c.uniforms.tDiffuse.value=w.texture,b.setRenderTarget(p),b.render(h,d),p=null,m=!1},this.isCompositing=function(){return m},this.dispose=function(){a.depthTexture&&a.depthTexture.dispose(),a.dispose(),o.dispose(),l.dispose(),c.dispose()}}var Fu=new nn,Sc=new si(1,1),Ou=new $s,Bu=new xa,zu=new ir,_u=[],xu=[],vu=new Float32Array(16),yu=new Float32Array(9),Mu=new Float32Array(4);function Ls(i,t,e){let n=i[0];if(n<=0||n>0)return i;let s=t*e,r=_u[s];if(r===void 0&&(r=new Float32Array(s),_u[s]=r),t!==0){n.toArray(r,0);for(let a=1,o=0;a!==t;++a)o+=e,i[a].toArray(r,o)}return r}function Fe(i,t){if(i.length!==t.length)return!1;for(let e=0,n=i.length;e<n;e++)if(i[e]!==t[e])return!1;return!0}function Oe(i,t){for(let e=0,n=t.length;e<n;e++)i[e]=t[e]}function Oo(i,t){let e=xu[t];e===void 0&&(e=new Int32Array(t),xu[t]=e);for(let n=0;n!==t;++n)e[n]=i.allocateTextureUnit();return e}function E0(i,t){let e=this.cache;e[0]!==t&&(i.uniform1f(this.addr,t),e[0]=t)}function w0(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Fe(e,t))return;i.uniform2fv(this.addr,t),Oe(e,t)}}function A0(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(i.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(Fe(e,t))return;i.uniform3fv(this.addr,t),Oe(e,t)}}function R0(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Fe(e,t))return;i.uniform4fv(this.addr,t),Oe(e,t)}}function C0(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(Fe(e,t))return;i.uniformMatrix2fv(this.addr,!1,t),Oe(e,t)}else{if(Fe(e,n))return;Mu.set(n),i.uniformMatrix2fv(this.addr,!1,Mu),Oe(e,n)}}function P0(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(Fe(e,t))return;i.uniformMatrix3fv(this.addr,!1,t),Oe(e,t)}else{if(Fe(e,n))return;yu.set(n),i.uniformMatrix3fv(this.addr,!1,yu),Oe(e,n)}}function I0(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(Fe(e,t))return;i.uniformMatrix4fv(this.addr,!1,t),Oe(e,t)}else{if(Fe(e,n))return;vu.set(n),i.uniformMatrix4fv(this.addr,!1,vu),Oe(e,n)}}function L0(i,t){let e=this.cache;e[0]!==t&&(i.uniform1i(this.addr,t),e[0]=t)}function D0(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Fe(e,t))return;i.uniform2iv(this.addr,t),Oe(e,t)}}function N0(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(Fe(e,t))return;i.uniform3iv(this.addr,t),Oe(e,t)}}function U0(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Fe(e,t))return;i.uniform4iv(this.addr,t),Oe(e,t)}}function F0(i,t){let e=this.cache;e[0]!==t&&(i.uniform1ui(this.addr,t),e[0]=t)}function O0(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Fe(e,t))return;i.uniform2uiv(this.addr,t),Oe(e,t)}}function B0(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(Fe(e,t))return;i.uniform3uiv(this.addr,t),Oe(e,t)}}function z0(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Fe(e,t))return;i.uniform4uiv(this.addr,t),Oe(e,t)}}function k0(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?(Sc.compareFunction=e.isReversedDepthBuffer()?Io:Po,r=Sc):r=Fu,e.setTexture2D(t||r,s)}function V0(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture3D(t||Bu,s)}function H0(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTextureCube(t||zu,s)}function G0(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture2DArray(t||Ou,s)}function W0(i){switch(i){case 5126:return E0;case 35664:return w0;case 35665:return A0;case 35666:return R0;case 35674:return C0;case 35675:return P0;case 35676:return I0;case 5124:case 35670:return L0;case 35667:case 35671:return D0;case 35668:case 35672:return N0;case 35669:case 35673:return U0;case 5125:return F0;case 36294:return O0;case 36295:return B0;case 36296:return z0;case 35678:case 36198:case 36298:case 36306:case 35682:return k0;case 35679:case 36299:case 36307:return V0;case 35680:case 36300:case 36308:case 36293:return H0;case 36289:case 36303:case 36311:case 36292:return G0}}function X0(i,t){i.uniform1fv(this.addr,t)}function q0(i,t){let e=Ls(t,this.size,2);i.uniform2fv(this.addr,e)}function Y0(i,t){let e=Ls(t,this.size,3);i.uniform3fv(this.addr,e)}function Z0(i,t){let e=Ls(t,this.size,4);i.uniform4fv(this.addr,e)}function K0(i,t){let e=Ls(t,this.size,4);i.uniformMatrix2fv(this.addr,!1,e)}function J0(i,t){let e=Ls(t,this.size,9);i.uniformMatrix3fv(this.addr,!1,e)}function $0(i,t){let e=Ls(t,this.size,16);i.uniformMatrix4fv(this.addr,!1,e)}function Q0(i,t){i.uniform1iv(this.addr,t)}function j0(i,t){i.uniform2iv(this.addr,t)}function tg(i,t){i.uniform3iv(this.addr,t)}function eg(i,t){i.uniform4iv(this.addr,t)}function ng(i,t){i.uniform1uiv(this.addr,t)}function ig(i,t){i.uniform2uiv(this.addr,t)}function sg(i,t){i.uniform3uiv(this.addr,t)}function rg(i,t){i.uniform4uiv(this.addr,t)}function ag(i,t,e){let n=this.cache,s=t.length,r=Oo(e,s);Fe(n,r)||(i.uniform1iv(this.addr,r),Oe(n,r));let a;this.type===i.SAMPLER_2D_SHADOW?a=Sc:a=Fu;for(let o=0;o!==s;++o)e.setTexture2D(t[o]||a,r[o])}function og(i,t,e){let n=this.cache,s=t.length,r=Oo(e,s);Fe(n,r)||(i.uniform1iv(this.addr,r),Oe(n,r));for(let a=0;a!==s;++a)e.setTexture3D(t[a]||Bu,r[a])}function lg(i,t,e){let n=this.cache,s=t.length,r=Oo(e,s);Fe(n,r)||(i.uniform1iv(this.addr,r),Oe(n,r));for(let a=0;a!==s;++a)e.setTextureCube(t[a]||zu,r[a])}function cg(i,t,e){let n=this.cache,s=t.length,r=Oo(e,s);Fe(n,r)||(i.uniform1iv(this.addr,r),Oe(n,r));for(let a=0;a!==s;++a)e.setTexture2DArray(t[a]||Ou,r[a])}function hg(i){switch(i){case 5126:return X0;case 35664:return q0;case 35665:return Y0;case 35666:return Z0;case 35674:return K0;case 35675:return J0;case 35676:return $0;case 5124:case 35670:return Q0;case 35667:case 35671:return j0;case 35668:case 35672:return tg;case 35669:case 35673:return eg;case 5125:return ng;case 36294:return ig;case 36295:return sg;case 36296:return rg;case 35678:case 36198:case 36298:case 36306:case 35682:return ag;case 35679:case 36299:case 36307:return og;case 35680:case 36300:case 36308:case 36293:return lg;case 36289:case 36303:case 36311:case 36292:return cg}}var bc=class{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.setValue=W0(e.type)}},Tc=class{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=hg(e.type)}},Ec=class{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,n){let s=this.seq;for(let r=0,a=s.length;r!==a;++r){let o=s[r];o.setValue(t,e[o.id],n)}}},yc=/(\w+)(\])?(\[|\.)?/g;function Su(i,t){i.seq.push(t),i.map[t.id]=t}function ug(i,t,e){let n=i.name,s=n.length;for(yc.lastIndex=0;;){let r=yc.exec(n),a=yc.lastIndex,o=r[1],l=r[2]==="]",c=r[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===s){Su(e,c===void 0?new bc(o,i,t):new Tc(o,i,t));break}else{let d=e.map[o];d===void 0&&(d=new Ec(o),Su(e,d)),e=d}}}var Ps=class{constructor(t,e){this.seq=[],this.map={};let n=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let a=0;a<n;++a){let o=t.getActiveUniform(e,a),l=t.getUniformLocation(e,o.name);ug(o,l,this)}let s=[],r=[];for(let a of this.seq)a.type===t.SAMPLER_2D_SHADOW||a.type===t.SAMPLER_CUBE_SHADOW||a.type===t.SAMPLER_2D_ARRAY_SHADOW?s.push(a):r.push(a);s.length>0&&(this.seq=s.concat(r))}setValue(t,e,n,s){let r=this.map[e];r!==void 0&&r.setValue(t,n,s)}setOptional(t,e,n){let s=e[n];s!==void 0&&this.setValue(t,n,s)}static upload(t,e,n,s){for(let r=0,a=e.length;r!==a;++r){let o=e[r],l=n[o.id];l.needsUpdate!==!1&&o.setValue(t,l.value,s)}}static seqWithValue(t,e){let n=[];for(let s=0,r=t.length;s!==r;++s){let a=t[s];a.id in e&&n.push(a)}return n}};function bu(i,t,e){let n=i.createShader(t);return i.shaderSource(n,e),i.compileShader(n),n}var dg=37297,fg=0;function pg(i,t){let e=i.split(`
`),n=[],s=Math.max(t-6,0),r=Math.min(t+6,e.length);for(let a=s;a<r;a++){let o=a+1;n.push(`${o===t?">":" "} ${o}: ${e[a]}`)}return n.join(`
`)}var Tu=new qt;function mg(i){se._getMatrix(Tu,se.workingColorSpace,i);let t=`mat3( ${Tu.elements.map(e=>e.toFixed(4))} )`;switch(se.getTransfer(i)){case Zs:return[t,"LinearTransferOETF"];case de:return[t,"sRGBTransferOETF"];default:return Gt("WebGLProgram: Unsupported color space: ",i),[t,"LinearTransferOETF"]}}function Eu(i,t,e){let n=i.getShaderParameter(t,i.COMPILE_STATUS),r=(i.getShaderInfoLog(t)||"").trim();if(n&&r==="")return"";let a=/ERROR: 0:(\d+)/.exec(r);if(a){let o=parseInt(a[1]);return e.toUpperCase()+`

`+r+`

`+pg(i.getShaderSource(t),o)}else return r}function gg(i,t){let e=mg(t);return[`vec4 ${i}( vec4 value ) {`,`	return ${e[1]}( vec4( value.rgb * ${e[0]}, value.a ) );`,"}"].join(`
`)}var _g={[Wl]:"Linear",[Xl]:"Reinhard",[ql]:"Cineon",[yr]:"ACESFilmic",[Zl]:"AgX",[Kl]:"Neutral",[Yl]:"Custom"};function xg(i,t){let e=_g[t];return e===void 0?(Gt("WebGLProgram: Unsupported toneMapping:",t),"vec3 "+i+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+i+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}var Do=new I;function vg(){se.getLuminanceCoefficients(Do);let i=Do.x.toFixed(4),t=Do.y.toFixed(4),e=Do.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${t}, ${e} );`,"	return dot( weights, rgb );","}"].join(`
`)}function yg(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(Ir).join(`
`)}function Mg(i){let t=[];for(let e in i){let n=i[e];n!==!1&&t.push("#define "+e+" "+n)}return t.join(`
`)}function Sg(i,t){let e={},n=i.getProgramParameter(t,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){let r=i.getActiveAttrib(t,s),a=r.name,o=1;r.type===i.FLOAT_MAT2&&(o=2),r.type===i.FLOAT_MAT3&&(o=3),r.type===i.FLOAT_MAT4&&(o=4),e[a]={type:r.type,location:i.getAttribLocation(t,a),locationSize:o}}return e}function Ir(i){return i!==""}function wu(i,t){let e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return i.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function Au(i,t){return i.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var bg=/^[ \t]*#include +<([\w\d./]+)>/gm;function wc(i){return i.replace(bg,Eg)}var Tg=new Map;function Eg(i,t){let e=jt[t];if(e===void 0){let n=Tg.get(t);if(n!==void 0)e=jt[n],Gt('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,n);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+t+">")}return wc(e)}var wg=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Ru(i){return i.replace(wg,Ag)}function Ag(i,t,e,n){let s="";for(let r=parseInt(t);r<parseInt(e);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function Cu(i){let t=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?t+=`
#define HIGH_PRECISION`:i.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}var Rg={[Gi]:"SHADOWMAP_TYPE_PCF",[Ts]:"SHADOWMAP_TYPE_VSM"};function Cg(i){return Rg[i.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var Pg={[Ti]:"ENVMAP_TYPE_CUBE",[Wi]:"ENVMAP_TYPE_CUBE",[Mr]:"ENVMAP_TYPE_CUBE_UV"};function Ig(i){return i.envMap===!1?"ENVMAP_TYPE_CUBE":Pg[i.envMapMode]||"ENVMAP_TYPE_CUBE"}var Lg={[Wi]:"ENVMAP_MODE_REFRACTION"};function Dg(i){return i.envMap===!1?"ENVMAP_MODE_REFLECTION":Lg[i.envMapMode]||"ENVMAP_MODE_REFLECTION"}var Ng={[Gl]:"ENVMAP_BLENDING_MULTIPLY",[Wh]:"ENVMAP_BLENDING_MIX",[Xh]:"ENVMAP_BLENDING_ADD"};function Ug(i){return i.envMap===!1?"ENVMAP_BLENDING_NONE":Ng[i.combine]||"ENVMAP_BLENDING_NONE"}function Fg(i){let t=i.envMapCubeUVHeight;if(t===null)return null;let e=Math.log2(t)-2,n=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,e),112)),texelHeight:n,maxMip:e}}function Og(i,t,e,n){let s=i.getContext(),r=e.defines,a=e.vertexShader,o=e.fragmentShader,l=Cg(e),c=Ig(e),h=Dg(e),d=Ug(e),u=Fg(e),f=yg(e),m=Mg(r),y=s.createProgram(),p,g,S=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(p=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,m].filter(Ir).join(`
`),p.length>0&&(p+=`
`),g=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,m].filter(Ir).join(`
`),g.length>0&&(g+=`
`)):(p=[Cu(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,m,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.batchingColor?"#define USE_BATCHING_COLOR":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.instancingMorph?"#define USE_INSTANCING_MORPH":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+h:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexNormals?"#define HAS_NORMAL":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",e.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(Ir).join(`
`),g=[Cu(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,m,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+c:"",e.envMap?"#define "+h:"",e.envMap?"#define "+d:"",u?"#define CUBEUV_TEXEL_WIDTH "+u.texelWidth:"",u?"#define CUBEUV_TEXEL_HEIGHT "+u.texelHeight:"",u?"#define CUBEUV_MAX_MIP "+u.maxMip+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.dispersion?"#define USE_DISPERSION":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor?"#define USE_COLOR":"",e.vertexAlphas||e.batchingColor?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",e.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",e.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==Cn?"#define TONE_MAPPING":"",e.toneMapping!==Cn?jt.tonemapping_pars_fragment:"",e.toneMapping!==Cn?xg("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",jt.colorspace_pars_fragment,gg("linearToOutputTexel",e.outputColorSpace),vg(),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(Ir).join(`
`)),a=wc(a),a=wu(a,e),a=Au(a,e),o=wc(o),o=wu(o,e),o=Au(o,e),a=Ru(a),o=Ru(o),e.isRawShaderMaterial!==!0&&(S=`#version 300 es
`,p=[f,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+p,g=["#define varying in",e.glslVersion===sc?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===sc?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+g);let b=S+p+a,v=S+g+o,w=bu(s,s.VERTEX_SHADER,b),T=bu(s,s.FRAGMENT_SHADER,v);s.attachShader(y,w),s.attachShader(y,T),e.index0AttributeName!==void 0?s.bindAttribLocation(y,0,e.index0AttributeName):e.hasPositionAttribute===!0&&s.bindAttribLocation(y,0,"position"),s.linkProgram(y);function R(C){if(i.debug.checkShaderErrors){let D=s.getProgramInfoLog(y)||"",W=s.getShaderInfoLog(w)||"",X=s.getShaderInfoLog(T)||"",O=D.trim(),H=W.trim(),V=X.trim(),K=!0,et=!0;if(s.getProgramParameter(y,s.LINK_STATUS)===!1)if(K=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,y,w,T);else{let ot=Eu(s,w,"vertex"),ct=Eu(s,T,"fragment");Ht("WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(y,s.VALIDATE_STATUS)+`

Material Name: `+C.name+`
Material Type: `+C.type+`

Program Info Log: `+O+`
`+ot+`
`+ct)}else O!==""?Gt("WebGLProgram: Program Info Log:",O):(H===""||V==="")&&(et=!1);et&&(C.diagnostics={runnable:K,programLog:O,vertexShader:{log:H,prefix:p},fragmentShader:{log:V,prefix:g}})}s.deleteShader(w),s.deleteShader(T),_=new Ps(s,y),E=Sg(s,y)}let _;this.getUniforms=function(){return _===void 0&&R(this),_};let E;this.getAttributes=function(){return E===void 0&&R(this),E};let P=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return P===!1&&(P=s.getProgramParameter(y,dg)),P},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(y),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=fg++,this.cacheKey=t,this.usedTimes=1,this.program=y,this.vertexShader=w,this.fragmentShader=T,this}var Bg=0,Ac=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t,e,n){let s=this._getShaderCacheForMaterial(t);return s.has(e)===!1&&(s.add(e),e.usedTimes++),s.has(n)===!1&&(s.add(n),n.usedTimes++),this}remove(t){let e=this.materialCache.get(t);for(let n of e)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(t),this}getVertexShaderStage(t){return this._getShaderStage(t.vertexShader)}getFragmentShaderStage(t){return this._getShaderStage(t.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){let e=this.materialCache,n=e.get(t);return n===void 0&&(n=new Set,e.set(t,n)),n}_getShaderStage(t){let e=this.shaderCache,n=e.get(t);return n===void 0&&(n=new Rc(t),e.set(t,n)),n}},Rc=class{constructor(t){this.id=Bg++,this.code=t,this.usedTimes=0}};function zg(i){return i===Ai||i===Ar||i===Rr}function kg(i,t,e,n,s,r){let a=new ms,o=new Ac,l=new Set,c=[],h=new Map,d=n.logarithmicDepthBuffer,u=n.precision,f={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function m(_){return l.add(_),_===0?"uv":`uv${_}`}function y(_,E,P,C,D,W){let X=C.fog,O=D.geometry,H=_.isMeshStandardMaterial||_.isMeshLambertMaterial||_.isMeshPhongMaterial?C.environment:null,V=_.isMeshStandardMaterial||_.isMeshLambertMaterial&&!_.envMap||_.isMeshPhongMaterial&&!_.envMap,K=t.get(_.envMap||H,V),et=K&&K.mapping===Mr?K.image.height:null,ot=f[_.type];_.precision!==null&&(u=n.getMaxPrecision(_.precision),u!==_.precision&&Gt("WebGLProgram.getParameters:",_.precision,"not supported, using",u,"instead."));let ct=O.morphAttributes.position||O.morphAttributes.normal||O.morphAttributes.color,it=ct!==void 0?ct.length:0,zt=0;O.morphAttributes.position!==void 0&&(zt=1),O.morphAttributes.normal!==void 0&&(zt=2),O.morphAttributes.color!==void 0&&(zt=3);let $t,Zt,Z,at;if(ot){let Ct=Wn[ot];$t=Ct.vertexShader,Zt=Ct.fragmentShader}else{$t=_.vertexShader,Zt=_.fragmentShader;let Ct=o.getVertexShaderStage(_),Ae=o.getFragmentShaderStage(_);o.update(_,Ct,Ae),Z=Ct.id,at=Ae.id}let tt=i.getRenderTarget(),pt=i.state.buffers.depth.getReversed(),Ft=D.isInstancedMesh===!0,Pt=D.isBatchedMesh===!0,ne=!!_.map,kt=!!_.matcap,j=!!K,rt=!!_.aoMap,st=!!_.lightMap,mt=!!_.bumpMap&&_.wireframe===!1,ut=!!_.normalMap,Ot=!!_.displacementMap,Rt=!!_.emissiveMap,Vt=!!_.metalnessMap,Xt=!!_.roughnessMap,L=_.anisotropy>0,ue=_.clearcoat>0,te=_.dispersion>0,A=_.iridescence>0,x=_.sheen>0,F=_.transmission>0,k=L&&!!_.anisotropyMap,q=ue&&!!_.clearcoatMap,lt=ue&&!!_.clearcoatNormalMap,dt=ue&&!!_.clearcoatRoughnessMap,Y=A&&!!_.iridescenceMap,Q=A&&!!_.iridescenceThicknessMap,gt=x&&!!_.sheenColorMap,Dt=x&&!!_.sheenRoughnessMap,vt=!!_.specularMap,_t=!!_.specularColorMap,Bt=!!_.specularIntensityMap,Wt=F&&!!_.transmissionMap,Kt=F&&!!_.thicknessMap,N=!!_.gradientMap,ft=!!_.alphaMap,$=_.alphaTest>0,xt=!!_.alphaHash,bt=!!_.extensions,nt=Cn;_.toneMapped&&(tt===null||tt.isXRRenderTarget===!0)&&(nt=i.toneMapping);let Lt={shaderID:ot,shaderType:_.type,shaderName:_.name,vertexShader:$t,fragmentShader:Zt,defines:_.defines,customVertexShaderID:Z,customFragmentShaderID:at,isRawShaderMaterial:_.isRawShaderMaterial===!0,glslVersion:_.glslVersion,precision:u,batching:Pt,batchingColor:Pt&&D._colorsTexture!==null,instancing:Ft,instancingColor:Ft&&D.instanceColor!==null,instancingMorph:Ft&&D.morphTexture!==null,outputColorSpace:tt===null?i.outputColorSpace:tt.isXRRenderTarget===!0?tt.texture.colorSpace:se.workingColorSpace,alphaToCoverage:!!_.alphaToCoverage,map:ne,matcap:kt,envMap:j,envMapMode:j&&K.mapping,envMapCubeUVHeight:et,aoMap:rt,lightMap:st,bumpMap:mt,normalMap:ut,displacementMap:Ot,emissiveMap:Rt,normalMapObjectSpace:ut&&_.normalMapType===Zh,normalMapTangentSpace:ut&&_.normalMapType===Co,packedNormalMap:ut&&_.normalMapType===Co&&zg(_.normalMap.format),metalnessMap:Vt,roughnessMap:Xt,anisotropy:L,anisotropyMap:k,clearcoat:ue,clearcoatMap:q,clearcoatNormalMap:lt,clearcoatRoughnessMap:dt,dispersion:te,iridescence:A,iridescenceMap:Y,iridescenceThicknessMap:Q,sheen:x,sheenColorMap:gt,sheenRoughnessMap:Dt,specularMap:vt,specularColorMap:_t,specularIntensityMap:Bt,transmission:F,transmissionMap:Wt,thicknessMap:Kt,gradientMap:N,opaque:_.transparent===!1&&_.blending===jn&&_.alphaToCoverage===!1,alphaMap:ft,alphaTest:$,alphaHash:xt,combine:_.combine,mapUv:ne&&m(_.map.channel),aoMapUv:rt&&m(_.aoMap.channel),lightMapUv:st&&m(_.lightMap.channel),bumpMapUv:mt&&m(_.bumpMap.channel),normalMapUv:ut&&m(_.normalMap.channel),displacementMapUv:Ot&&m(_.displacementMap.channel),emissiveMapUv:Rt&&m(_.emissiveMap.channel),metalnessMapUv:Vt&&m(_.metalnessMap.channel),roughnessMapUv:Xt&&m(_.roughnessMap.channel),anisotropyMapUv:k&&m(_.anisotropyMap.channel),clearcoatMapUv:q&&m(_.clearcoatMap.channel),clearcoatNormalMapUv:lt&&m(_.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:dt&&m(_.clearcoatRoughnessMap.channel),iridescenceMapUv:Y&&m(_.iridescenceMap.channel),iridescenceThicknessMapUv:Q&&m(_.iridescenceThicknessMap.channel),sheenColorMapUv:gt&&m(_.sheenColorMap.channel),sheenRoughnessMapUv:Dt&&m(_.sheenRoughnessMap.channel),specularMapUv:vt&&m(_.specularMap.channel),specularColorMapUv:_t&&m(_.specularColorMap.channel),specularIntensityMapUv:Bt&&m(_.specularIntensityMap.channel),transmissionMapUv:Wt&&m(_.transmissionMap.channel),thicknessMapUv:Kt&&m(_.thicknessMap.channel),alphaMapUv:ft&&m(_.alphaMap.channel),vertexTangents:!!O.attributes.tangent&&(ut||L),vertexNormals:!!O.attributes.normal,vertexColors:_.vertexColors,vertexAlphas:_.vertexColors===!0&&!!O.attributes.color&&O.attributes.color.itemSize===4,pointsUvs:D.isPoints===!0&&!!O.attributes.uv&&(ne||ft),fog:!!X,useFog:_.fog===!0,fogExp2:!!X&&X.isFogExp2,flatShading:_.wireframe===!1&&(_.flatShading===!0||O.attributes.normal===void 0&&ut===!1&&(_.isMeshLambertMaterial||_.isMeshPhongMaterial||_.isMeshStandardMaterial||_.isMeshPhysicalMaterial)),sizeAttenuation:_.sizeAttenuation===!0,logarithmicDepthBuffer:d,reversedDepthBuffer:pt,skinning:D.isSkinnedMesh===!0,hasPositionAttribute:O.attributes.position!==void 0,morphTargets:O.morphAttributes.position!==void 0,morphNormals:O.morphAttributes.normal!==void 0,morphColors:O.morphAttributes.color!==void 0,morphTargetsCount:it,morphTextureStride:zt,numDirLights:E.directional.length,numPointLights:E.point.length,numSpotLights:E.spot.length,numSpotLightMaps:E.spotLightMap.length,numRectAreaLights:E.rectArea.length,numHemiLights:E.hemi.length,numDirLightShadows:E.directionalShadowMap.length,numPointLightShadows:E.pointShadowMap.length,numSpotLightShadows:E.spotShadowMap.length,numSpotLightShadowsWithMaps:E.numSpotLightShadowsWithMaps,numLightProbes:E.numLightProbes,numLightProbeGrids:W.length,numClippingPlanes:r.numPlanes,numClipIntersection:r.numIntersection,dithering:_.dithering,shadowMapEnabled:i.shadowMap.enabled&&P.length>0,shadowMapType:i.shadowMap.type,toneMapping:nt,decodeVideoTexture:ne&&_.map.isVideoTexture===!0&&se.getTransfer(_.map.colorSpace)===de,decodeVideoTextureEmissive:Rt&&_.emissiveMap.isVideoTexture===!0&&se.getTransfer(_.emissiveMap.colorSpace)===de,premultipliedAlpha:_.premultipliedAlpha,doubleSided:_.side===qe,flipSided:_.side===rn,useDepthPacking:_.depthPacking>=0,depthPacking:_.depthPacking||0,index0AttributeName:_.index0AttributeName,extensionClipCullDistance:bt&&_.extensions.clipCullDistance===!0&&e.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(bt&&_.extensions.multiDraw===!0||Pt)&&e.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:e.has("KHR_parallel_shader_compile"),customProgramCacheKey:_.customProgramCacheKey()};return Lt.vertexUv1s=l.has(1),Lt.vertexUv2s=l.has(2),Lt.vertexUv3s=l.has(3),l.clear(),Lt}function p(_){let E=[];if(_.shaderID?E.push(_.shaderID):(E.push(_.customVertexShaderID),E.push(_.customFragmentShaderID)),_.defines!==void 0)for(let P in _.defines)E.push(P),E.push(_.defines[P]);return _.isRawShaderMaterial===!1&&(g(E,_),S(E,_),E.push(i.outputColorSpace)),E.push(_.customProgramCacheKey),E.join()}function g(_,E){_.push(E.precision),_.push(E.outputColorSpace),_.push(E.envMapMode),_.push(E.envMapCubeUVHeight),_.push(E.mapUv),_.push(E.alphaMapUv),_.push(E.lightMapUv),_.push(E.aoMapUv),_.push(E.bumpMapUv),_.push(E.normalMapUv),_.push(E.displacementMapUv),_.push(E.emissiveMapUv),_.push(E.metalnessMapUv),_.push(E.roughnessMapUv),_.push(E.anisotropyMapUv),_.push(E.clearcoatMapUv),_.push(E.clearcoatNormalMapUv),_.push(E.clearcoatRoughnessMapUv),_.push(E.iridescenceMapUv),_.push(E.iridescenceThicknessMapUv),_.push(E.sheenColorMapUv),_.push(E.sheenRoughnessMapUv),_.push(E.specularMapUv),_.push(E.specularColorMapUv),_.push(E.specularIntensityMapUv),_.push(E.transmissionMapUv),_.push(E.thicknessMapUv),_.push(E.combine),_.push(E.fogExp2),_.push(E.sizeAttenuation),_.push(E.morphTargetsCount),_.push(E.morphAttributeCount),_.push(E.numDirLights),_.push(E.numPointLights),_.push(E.numSpotLights),_.push(E.numSpotLightMaps),_.push(E.numHemiLights),_.push(E.numRectAreaLights),_.push(E.numDirLightShadows),_.push(E.numPointLightShadows),_.push(E.numSpotLightShadows),_.push(E.numSpotLightShadowsWithMaps),_.push(E.numLightProbes),_.push(E.shadowMapType),_.push(E.toneMapping),_.push(E.numClippingPlanes),_.push(E.numClipIntersection),_.push(E.depthPacking)}function S(_,E){a.disableAll(),E.instancing&&a.enable(0),E.instancingColor&&a.enable(1),E.instancingMorph&&a.enable(2),E.matcap&&a.enable(3),E.envMap&&a.enable(4),E.normalMapObjectSpace&&a.enable(5),E.normalMapTangentSpace&&a.enable(6),E.clearcoat&&a.enable(7),E.iridescence&&a.enable(8),E.alphaTest&&a.enable(9),E.vertexColors&&a.enable(10),E.vertexAlphas&&a.enable(11),E.vertexUv1s&&a.enable(12),E.vertexUv2s&&a.enable(13),E.vertexUv3s&&a.enable(14),E.vertexTangents&&a.enable(15),E.anisotropy&&a.enable(16),E.alphaHash&&a.enable(17),E.batching&&a.enable(18),E.dispersion&&a.enable(19),E.batchingColor&&a.enable(20),E.gradientMap&&a.enable(21),E.packedNormalMap&&a.enable(22),E.vertexNormals&&a.enable(23),_.push(a.mask),a.disableAll(),E.fog&&a.enable(0),E.useFog&&a.enable(1),E.flatShading&&a.enable(2),E.logarithmicDepthBuffer&&a.enable(3),E.reversedDepthBuffer&&a.enable(4),E.skinning&&a.enable(5),E.morphTargets&&a.enable(6),E.morphNormals&&a.enable(7),E.morphColors&&a.enable(8),E.premultipliedAlpha&&a.enable(9),E.shadowMapEnabled&&a.enable(10),E.doubleSided&&a.enable(11),E.flipSided&&a.enable(12),E.useDepthPacking&&a.enable(13),E.dithering&&a.enable(14),E.transmission&&a.enable(15),E.sheen&&a.enable(16),E.opaque&&a.enable(17),E.pointsUvs&&a.enable(18),E.decodeVideoTexture&&a.enable(19),E.decodeVideoTextureEmissive&&a.enable(20),E.alphaToCoverage&&a.enable(21),E.numLightProbeGrids>0&&a.enable(22),E.hasPositionAttribute&&a.enable(23),_.push(a.mask)}function b(_){let E=f[_.type],P;if(E){let C=Wn[E];P=hu.clone(C.uniforms)}else P=_.uniforms;return P}function v(_,E){let P=h.get(E);return P!==void 0?++P.usedTimes:(P=new Og(i,E,_,s),c.push(P),h.set(E,P)),P}function w(_){if(--_.usedTimes===0){let E=c.indexOf(_);c[E]=c[c.length-1],c.pop(),h.delete(_.cacheKey),_.destroy()}}function T(_){o.remove(_)}function R(){o.dispose()}return{getParameters:y,getProgramCacheKey:p,getUniforms:b,acquireProgram:v,releaseProgram:w,releaseShaderCache:T,programs:c,dispose:R}}function Vg(){let i=new WeakMap;function t(a){return i.has(a)}function e(a){let o=i.get(a);return o===void 0&&(o={},i.set(a,o)),o}function n(a){i.delete(a)}function s(a,o,l){i.get(a)[o]=l}function r(){i=new WeakMap}return{has:t,get:e,remove:n,update:s,dispose:r}}function Hg(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.material.id!==t.material.id?i.material.id-t.material.id:i.materialVariant!==t.materialVariant?i.materialVariant-t.materialVariant:i.z!==t.z?i.z-t.z:i.id-t.id}function Pu(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.z!==t.z?t.z-i.z:i.id-t.id}function Iu(){let i=[],t=0,e=[],n=[],s=[];function r(){t=0,e.length=0,n.length=0,s.length=0}function a(u){let f=0;return u.isInstancedMesh&&(f+=2),u.isSkinnedMesh&&(f+=1),f}function o(u,f,m,y,p,g){let S=i[t];return S===void 0?(S={id:u.id,object:u,geometry:f,material:m,materialVariant:a(u),groupOrder:y,renderOrder:u.renderOrder,z:p,group:g},i[t]=S):(S.id=u.id,S.object=u,S.geometry=f,S.material=m,S.materialVariant=a(u),S.groupOrder=y,S.renderOrder=u.renderOrder,S.z=p,S.group=g),t++,S}function l(u,f,m,y,p,g){let S=o(u,f,m,y,p,g);m.transmission>0?n.push(S):m.transparent===!0?s.push(S):e.push(S)}function c(u,f,m,y,p,g){let S=o(u,f,m,y,p,g);m.transmission>0?n.unshift(S):m.transparent===!0?s.unshift(S):e.unshift(S)}function h(u,f,m){e.length>1&&e.sort(u||Hg),n.length>1&&n.sort(f||Pu),s.length>1&&s.sort(f||Pu),m&&(e.reverse(),n.reverse(),s.reverse())}function d(){for(let u=t,f=i.length;u<f;u++){let m=i[u];if(m.id===null)break;m.id=null,m.object=null,m.geometry=null,m.material=null,m.group=null}}return{opaque:e,transmissive:n,transparent:s,init:r,push:l,unshift:c,finish:d,sort:h}}function Gg(){let i=new WeakMap;function t(n,s){let r=i.get(n),a;return r===void 0?(a=new Iu,i.set(n,[a])):s>=r.length?(a=new Iu,r.push(a)):a=r[s],a}function e(){i=new WeakMap}return{get:t,dispose:e}}function Wg(){let i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"DirectionalLight":e={direction:new I,color:new Yt};break;case"SpotLight":e={position:new I,direction:new I,color:new Yt,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new I,color:new Yt,distance:0,decay:0};break;case"HemisphereLight":e={direction:new I,skyColor:new Yt,groundColor:new Yt};break;case"RectAreaLight":e={color:new Yt,position:new I,halfWidth:new I,halfHeight:new I};break}return i[t.id]=e,e}}}function Xg(){let i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"DirectionalLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ht};break;case"SpotLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ht};break;case"PointLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ht,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[t.id]=e,e}}}var qg=0;function Yg(i,t){return(t.castShadow?2:0)-(i.castShadow?2:0)+(t.map?1:0)-(i.map?1:0)}function Zg(i){let t=new Wg,e=Xg(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new I);let s=new I,r=new ve,a=new ve;function o(c){let h=0,d=0,u=0;for(let E=0;E<9;E++)n.probe[E].set(0,0,0);let f=0,m=0,y=0,p=0,g=0,S=0,b=0,v=0,w=0,T=0,R=0;c.sort(Yg);for(let E=0,P=c.length;E<P;E++){let C=c[E],D=C.color,W=C.intensity,X=C.distance,O=null;if(C.shadow&&C.shadow.map&&(C.shadow.map.texture.format===Ai?O=C.shadow.map.texture:O=C.shadow.map.depthTexture||C.shadow.map.texture),C.isAmbientLight)h+=D.r*W,d+=D.g*W,u+=D.b*W;else if(C.isLightProbe){for(let H=0;H<9;H++)n.probe[H].addScaledVector(C.sh.coefficients[H],W);R++}else if(C.isDirectionalLight){let H=t.get(C);if(H.color.copy(C.color).multiplyScalar(C.intensity),C.castShadow){let V=C.shadow,K=e.get(C);K.shadowIntensity=V.intensity,K.shadowBias=V.bias,K.shadowNormalBias=V.normalBias,K.shadowRadius=V.radius,K.shadowMapSize=V.mapSize,n.directionalShadow[f]=K,n.directionalShadowMap[f]=O,n.directionalShadowMatrix[f]=C.shadow.matrix,S++}n.directional[f]=H,f++}else if(C.isSpotLight){let H=t.get(C);H.position.setFromMatrixPosition(C.matrixWorld),H.color.copy(D).multiplyScalar(W),H.distance=X,H.coneCos=Math.cos(C.angle),H.penumbraCos=Math.cos(C.angle*(1-C.penumbra)),H.decay=C.decay,n.spot[y]=H;let V=C.shadow;if(C.map&&(n.spotLightMap[w]=C.map,w++,V.updateMatrices(C),C.castShadow&&T++),n.spotLightMatrix[y]=V.matrix,C.castShadow){let K=e.get(C);K.shadowIntensity=V.intensity,K.shadowBias=V.bias,K.shadowNormalBias=V.normalBias,K.shadowRadius=V.radius,K.shadowMapSize=V.mapSize,n.spotShadow[y]=K,n.spotShadowMap[y]=O,v++}y++}else if(C.isRectAreaLight){let H=t.get(C);H.color.copy(D).multiplyScalar(W),H.halfWidth.set(C.width*.5,0,0),H.halfHeight.set(0,C.height*.5,0),n.rectArea[p]=H,p++}else if(C.isPointLight){let H=t.get(C);if(H.color.copy(C.color).multiplyScalar(C.intensity),H.distance=C.distance,H.decay=C.decay,C.castShadow){let V=C.shadow,K=e.get(C);K.shadowIntensity=V.intensity,K.shadowBias=V.bias,K.shadowNormalBias=V.normalBias,K.shadowRadius=V.radius,K.shadowMapSize=V.mapSize,K.shadowCameraNear=V.camera.near,K.shadowCameraFar=V.camera.far,n.pointShadow[m]=K,n.pointShadowMap[m]=O,n.pointShadowMatrix[m]=C.shadow.matrix,b++}n.point[m]=H,m++}else if(C.isHemisphereLight){let H=t.get(C);H.skyColor.copy(C.color).multiplyScalar(W),H.groundColor.copy(C.groundColor).multiplyScalar(W),n.hemi[g]=H,g++}}p>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=yt.LTC_FLOAT_1,n.rectAreaLTC2=yt.LTC_FLOAT_2):(n.rectAreaLTC1=yt.LTC_HALF_1,n.rectAreaLTC2=yt.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=d,n.ambient[2]=u;let _=n.hash;(_.directionalLength!==f||_.pointLength!==m||_.spotLength!==y||_.rectAreaLength!==p||_.hemiLength!==g||_.numDirectionalShadows!==S||_.numPointShadows!==b||_.numSpotShadows!==v||_.numSpotMaps!==w||_.numLightProbes!==R)&&(n.directional.length=f,n.spot.length=y,n.rectArea.length=p,n.point.length=m,n.hemi.length=g,n.directionalShadow.length=S,n.directionalShadowMap.length=S,n.pointShadow.length=b,n.pointShadowMap.length=b,n.spotShadow.length=v,n.spotShadowMap.length=v,n.directionalShadowMatrix.length=S,n.pointShadowMatrix.length=b,n.spotLightMatrix.length=v+w-T,n.spotLightMap.length=w,n.numSpotLightShadowsWithMaps=T,n.numLightProbes=R,_.directionalLength=f,_.pointLength=m,_.spotLength=y,_.rectAreaLength=p,_.hemiLength=g,_.numDirectionalShadows=S,_.numPointShadows=b,_.numSpotShadows=v,_.numSpotMaps=w,_.numLightProbes=R,n.version=qg++)}function l(c,h){let d=0,u=0,f=0,m=0,y=0,p=h.matrixWorldInverse;for(let g=0,S=c.length;g<S;g++){let b=c[g];if(b.isDirectionalLight){let v=n.directional[d];v.direction.setFromMatrixPosition(b.matrixWorld),s.setFromMatrixPosition(b.target.matrixWorld),v.direction.sub(s),v.direction.transformDirection(p),d++}else if(b.isSpotLight){let v=n.spot[f];v.position.setFromMatrixPosition(b.matrixWorld),v.position.applyMatrix4(p),v.direction.setFromMatrixPosition(b.matrixWorld),s.setFromMatrixPosition(b.target.matrixWorld),v.direction.sub(s),v.direction.transformDirection(p),f++}else if(b.isRectAreaLight){let v=n.rectArea[m];v.position.setFromMatrixPosition(b.matrixWorld),v.position.applyMatrix4(p),a.identity(),r.copy(b.matrixWorld),r.premultiply(p),a.extractRotation(r),v.halfWidth.set(b.width*.5,0,0),v.halfHeight.set(0,b.height*.5,0),v.halfWidth.applyMatrix4(a),v.halfHeight.applyMatrix4(a),m++}else if(b.isPointLight){let v=n.point[u];v.position.setFromMatrixPosition(b.matrixWorld),v.position.applyMatrix4(p),u++}else if(b.isHemisphereLight){let v=n.hemi[y];v.direction.setFromMatrixPosition(b.matrixWorld),v.direction.transformDirection(p),y++}}}return{setup:o,setupView:l,state:n}}function Lu(i){let t=new Zg(i),e=[],n=[],s=[];function r(u){d.camera=u,e.length=0,n.length=0,s.length=0}function a(u){e.push(u)}function o(u){n.push(u)}function l(u){s.push(u)}function c(){t.setup(e)}function h(u){t.setupView(e,u)}let d={lightsArray:e,shadowsArray:n,lightProbeGridArray:s,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:r,state:d,setupLights:c,setupLightsView:h,pushLight:a,pushShadow:o,pushLightProbeGrid:l}}function Kg(i){let t=new WeakMap;function e(s,r=0){let a=t.get(s),o;return a===void 0?(o=new Lu(i),t.set(s,[o])):r>=a.length?(o=new Lu(i),a.push(o)):o=a[r],o}function n(){t=new WeakMap}return{get:e,dispose:n}}var Jg=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,$g=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,Qg=[new I(1,0,0),new I(-1,0,0),new I(0,1,0),new I(0,-1,0),new I(0,0,1),new I(0,0,-1)],jg=[new I(0,-1,0),new I(0,-1,0),new I(0,0,1),new I(0,0,-1),new I(0,-1,0),new I(0,-1,0)],Du=new ve,Pr=new I,Mc=new I;function t_(i,t,e){let n=new xs,s=new ht,r=new ht,a=new Te,o=new Ca,l=new Pa,c={},h=e.maxTextureSize,d={[Qn]:rn,[rn]:Qn,[qe]:qe},u=new sn({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new ht},radius:{value:4}},vertexShader:Jg,fragmentShader:$g}),f=u.clone();f.defines.HORIZONTAL_PASS=1;let m=new Ue;m.setAttribute("position",new ye(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let y=new Tt(m,u),p=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Gi;let g=this.type;this.render=function(T,R,_){if(p.enabled===!1||p.autoUpdate===!1&&p.needsUpdate===!1||T.length===0)return;this.type===Eh&&(Gt("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."),this.type=Gi);let E=i.getRenderTarget(),P=i.getActiveCubeFace(),C=i.getActiveMipmapLevel(),D=i.state;D.setBlending(Vn),D.buffers.depth.getReversed()===!0?D.buffers.color.setClear(0,0,0,0):D.buffers.color.setClear(1,1,1,1),D.buffers.depth.setTest(!0),D.setScissorTest(!1);let W=g!==this.type;W&&R.traverse(function(X){X.material&&(Array.isArray(X.material)?X.material.forEach(O=>O.needsUpdate=!0):X.material.needsUpdate=!0)});for(let X=0,O=T.length;X<O;X++){let H=T[X],V=H.shadow;if(V===void 0){Gt("WebGLShadowMap:",H,"has no shadow.");continue}if(V.autoUpdate===!1&&V.needsUpdate===!1)continue;s.copy(V.mapSize);let K=V.getFrameExtents();s.multiply(K),r.copy(V.mapSize),(s.x>h||s.y>h)&&(s.x>h&&(r.x=Math.floor(h/K.x),s.x=r.x*K.x,V.mapSize.x=r.x),s.y>h&&(r.y=Math.floor(h/K.y),s.y=r.y*K.y,V.mapSize.y=r.y));let et=i.state.buffers.depth.getReversed();if(V.camera._reversedDepth=et,V.map===null||W===!0){if(V.map!==null&&(V.map.depthTexture!==null&&(V.map.depthTexture.dispose(),V.map.depthTexture=null),V.map.dispose()),this.type===Ts){if(H.isPointLight){Gt("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}V.map=new fn(s.x,s.y,{format:Ai,type:Hn,minFilter:Xe,magFilter:Xe,generateMipmaps:!1}),V.map.texture.name=H.name+".shadowMap",V.map.depthTexture=new si(s.x,s.y,In),V.map.depthTexture.name=H.name+".shadowMapDepth",V.map.depthTexture.format=On,V.map.depthTexture.compareFunction=null,V.map.depthTexture.minFilter=ke,V.map.depthTexture.magFilter=ke}else H.isPointLight?(V.map=new No(s.x),V.map.depthTexture=new Ma(s.x,Pn)):(V.map=new fn(s.x,s.y),V.map.depthTexture=new si(s.x,s.y,Pn)),V.map.depthTexture.name=H.name+".shadowMap",V.map.depthTexture.format=On,this.type===Gi?(V.map.depthTexture.compareFunction=et?Io:Po,V.map.depthTexture.minFilter=Xe,V.map.depthTexture.magFilter=Xe):(V.map.depthTexture.compareFunction=null,V.map.depthTexture.minFilter=ke,V.map.depthTexture.magFilter=ke);V.camera.updateProjectionMatrix()}let ot=V.map.isWebGLCubeRenderTarget?6:1;for(let ct=0;ct<ot;ct++){if(V.map.isWebGLCubeRenderTarget)i.setRenderTarget(V.map,ct),i.clear();else{ct===0&&(i.setRenderTarget(V.map),i.clear());let it=V.getViewport(ct);a.set(r.x*it.x,r.y*it.y,r.x*it.z,r.y*it.w),D.viewport(a)}if(H.isPointLight){let it=V.camera,zt=V.matrix,$t=H.distance||it.far;$t!==it.far&&(it.far=$t,it.updateProjectionMatrix()),Pr.setFromMatrixPosition(H.matrixWorld),it.position.copy(Pr),Mc.copy(it.position),Mc.add(Qg[ct]),it.up.copy(jg[ct]),it.lookAt(Mc),it.updateMatrixWorld(),zt.makeTranslation(-Pr.x,-Pr.y,-Pr.z),Du.multiplyMatrices(it.projectionMatrix,it.matrixWorldInverse),V._frustum.setFromProjectionMatrix(Du,it.coordinateSystem,it.reversedDepth)}else V.updateMatrices(H);n=V.getFrustum(),v(R,_,V.camera,H,this.type)}V.isPointLightShadow!==!0&&this.type===Ts&&S(V,_),V.needsUpdate=!1}g=this.type,p.needsUpdate=!1,i.setRenderTarget(E,P,C)};function S(T,R){let _=t.update(y);u.defines.VSM_SAMPLES!==T.blurSamples&&(u.defines.VSM_SAMPLES=T.blurSamples,f.defines.VSM_SAMPLES=T.blurSamples,u.needsUpdate=!0,f.needsUpdate=!0),T.mapPass===null&&(T.mapPass=new fn(s.x,s.y,{format:Ai,type:Hn})),u.uniforms.shadow_pass.value=T.map.depthTexture,u.uniforms.resolution.value=T.mapSize,u.uniforms.radius.value=T.radius,i.setRenderTarget(T.mapPass),i.clear(),i.renderBufferDirect(R,null,_,u,y,null),f.uniforms.shadow_pass.value=T.mapPass.texture,f.uniforms.resolution.value=T.mapSize,f.uniforms.radius.value=T.radius,i.setRenderTarget(T.map),i.clear(),i.renderBufferDirect(R,null,_,f,y,null)}function b(T,R,_,E){let P=null,C=_.isPointLight===!0?T.customDistanceMaterial:T.customDepthMaterial;if(C!==void 0)P=C;else if(P=_.isPointLight===!0?l:o,i.localClippingEnabled&&R.clipShadows===!0&&Array.isArray(R.clippingPlanes)&&R.clippingPlanes.length!==0||R.displacementMap&&R.displacementScale!==0||R.alphaMap&&R.alphaTest>0||R.map&&R.alphaTest>0||R.alphaToCoverage===!0){let D=P.uuid,W=R.uuid,X=c[D];X===void 0&&(X={},c[D]=X);let O=X[W];O===void 0&&(O=P.clone(),X[W]=O,R.addEventListener("dispose",w)),P=O}if(P.visible=R.visible,P.wireframe=R.wireframe,E===Ts?P.side=R.shadowSide!==null?R.shadowSide:R.side:P.side=R.shadowSide!==null?R.shadowSide:d[R.side],P.alphaMap=R.alphaMap,P.alphaTest=R.alphaToCoverage===!0?.5:R.alphaTest,P.map=R.map,P.clipShadows=R.clipShadows,P.clippingPlanes=R.clippingPlanes,P.clipIntersection=R.clipIntersection,P.displacementMap=R.displacementMap,P.displacementScale=R.displacementScale,P.displacementBias=R.displacementBias,P.wireframeLinewidth=R.wireframeLinewidth,P.linewidth=R.linewidth,_.isPointLight===!0&&P.isMeshDistanceMaterial===!0){let D=i.properties.get(P);D.light=_}return P}function v(T,R,_,E,P){if(T.visible===!1)return;if(T.layers.test(R.layers)&&(T.isMesh||T.isLine||T.isPoints)&&(T.castShadow||T.receiveShadow&&P===Ts)&&(!T.frustumCulled||n.intersectsObject(T))){T.modelViewMatrix.multiplyMatrices(_.matrixWorldInverse,T.matrixWorld);let W=t.update(T),X=T.material;if(Array.isArray(X)){let O=W.groups;for(let H=0,V=O.length;H<V;H++){let K=O[H],et=X[K.materialIndex];if(et&&et.visible){let ot=b(T,et,E,P);T.onBeforeShadow(i,T,R,_,W,ot,K),i.renderBufferDirect(_,null,W,ot,T,K),T.onAfterShadow(i,T,R,_,W,ot,K)}}}else if(X.visible){let O=b(T,X,E,P);T.onBeforeShadow(i,T,R,_,W,O,null),i.renderBufferDirect(_,null,W,O,T,null),T.onAfterShadow(i,T,R,_,W,O,null)}}let D=T.children;for(let W=0,X=D.length;W<X;W++)v(D[W],R,_,E,P)}function w(T){T.target.removeEventListener("dispose",w);for(let _ in c){let E=c[_],P=T.target.uuid;P in E&&(E[P].dispose(),delete E[P])}}}function e_(i,t){function e(){let N=!1,ft=new Te,$=null,xt=new Te(0,0,0,0);return{setMask:function(bt){$!==bt&&!N&&(i.colorMask(bt,bt,bt,bt),$=bt)},setLocked:function(bt){N=bt},setClear:function(bt,nt,Lt,Ct,Ae){Ae===!0&&(bt*=Ct,nt*=Ct,Lt*=Ct),ft.set(bt,nt,Lt,Ct),xt.equals(ft)===!1&&(i.clearColor(bt,nt,Lt,Ct),xt.copy(ft))},reset:function(){N=!1,$=null,xt.set(-1,0,0,0)}}}function n(){let N=!1,ft=!1,$=null,xt=null,bt=null;return{setReversed:function(nt){if(ft!==nt){let Lt=t.get("EXT_clip_control");nt?Lt.clipControlEXT(Lt.LOWER_LEFT_EXT,Lt.ZERO_TO_ONE_EXT):Lt.clipControlEXT(Lt.LOWER_LEFT_EXT,Lt.NEGATIVE_ONE_TO_ONE_EXT),ft=nt;let Ct=bt;bt=null,this.setClear(Ct)}},getReversed:function(){return ft},setTest:function(nt){nt?tt(i.DEPTH_TEST):pt(i.DEPTH_TEST)},setMask:function(nt){$!==nt&&!N&&(i.depthMask(nt),$=nt)},setFunc:function(nt){if(ft&&(nt=su[nt]),xt!==nt){switch(nt){case oa:i.depthFunc(i.NEVER);break;case la:i.depthFunc(i.ALWAYS);break;case ca:i.depthFunc(i.LESS);break;case zi:i.depthFunc(i.LEQUAL);break;case ha:i.depthFunc(i.EQUAL);break;case ua:i.depthFunc(i.GEQUAL);break;case da:i.depthFunc(i.GREATER);break;case fa:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}xt=nt}},setLocked:function(nt){N=nt},setClear:function(nt){bt!==nt&&(bt=nt,ft&&(nt=1-nt),i.clearDepth(nt))},reset:function(){N=!1,$=null,xt=null,bt=null,ft=!1}}}function s(){let N=!1,ft=null,$=null,xt=null,bt=null,nt=null,Lt=null,Ct=null,Ae=null;return{setTest:function(_e){N||(_e?tt(i.STENCIL_TEST):pt(i.STENCIL_TEST))},setMask:function(_e){ft!==_e&&!N&&(i.stencilMask(_e),ft=_e)},setFunc:function(_e,Ln,Dn){($!==_e||xt!==Ln||bt!==Dn)&&(i.stencilFunc(_e,Ln,Dn),$=_e,xt=Ln,bt=Dn)},setOp:function(_e,Ln,Dn){(nt!==_e||Lt!==Ln||Ct!==Dn)&&(i.stencilOp(_e,Ln,Dn),nt=_e,Lt=Ln,Ct=Dn)},setLocked:function(_e){N=_e},setClear:function(_e){Ae!==_e&&(i.clearStencil(_e),Ae=_e)},reset:function(){N=!1,ft=null,$=null,xt=null,bt=null,nt=null,Lt=null,Ct=null,Ae=null}}}let r=new e,a=new n,o=new s,l=new WeakMap,c=new WeakMap,h={},d={},u={},f=new WeakMap,m=[],y=null,p=!1,g=null,S=null,b=null,v=null,w=null,T=null,R=null,_=new Yt(0,0,0),E=0,P=!1,C=null,D=null,W=null,X=null,O=null,H=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS),V=!1,K=0,et=i.getParameter(i.VERSION);et.indexOf("WebGL")!==-1?(K=parseFloat(/^WebGL (\d)/.exec(et)[1]),V=K>=1):et.indexOf("OpenGL ES")!==-1&&(K=parseFloat(/^OpenGL ES (\d)/.exec(et)[1]),V=K>=2);let ot=null,ct={},it=i.getParameter(i.SCISSOR_BOX),zt=i.getParameter(i.VIEWPORT),$t=new Te().fromArray(it),Zt=new Te().fromArray(zt);function Z(N,ft,$,xt){let bt=new Uint8Array(4),nt=i.createTexture();i.bindTexture(N,nt),i.texParameteri(N,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(N,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let Lt=0;Lt<$;Lt++)N===i.TEXTURE_3D||N===i.TEXTURE_2D_ARRAY?i.texImage3D(ft,0,i.RGBA,1,1,xt,0,i.RGBA,i.UNSIGNED_BYTE,bt):i.texImage2D(ft+Lt,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,bt);return nt}let at={};at[i.TEXTURE_2D]=Z(i.TEXTURE_2D,i.TEXTURE_2D,1),at[i.TEXTURE_CUBE_MAP]=Z(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),at[i.TEXTURE_2D_ARRAY]=Z(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),at[i.TEXTURE_3D]=Z(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),a.setClear(1),o.setClear(0),tt(i.DEPTH_TEST),a.setFunc(zi),mt(!1),ut(zl),tt(i.CULL_FACE),rt(Vn);function tt(N){h[N]!==!0&&(i.enable(N),h[N]=!0)}function pt(N){h[N]!==!1&&(i.disable(N),h[N]=!1)}function Ft(N,ft){return u[N]!==ft?(i.bindFramebuffer(N,ft),u[N]=ft,N===i.DRAW_FRAMEBUFFER&&(u[i.FRAMEBUFFER]=ft),N===i.FRAMEBUFFER&&(u[i.DRAW_FRAMEBUFFER]=ft),!0):!1}function Pt(N,ft){let $=m,xt=!1;if(N){$=f.get(ft),$===void 0&&($=[],f.set(ft,$));let bt=N.textures;if($.length!==bt.length||$[0]!==i.COLOR_ATTACHMENT0){for(let nt=0,Lt=bt.length;nt<Lt;nt++)$[nt]=i.COLOR_ATTACHMENT0+nt;$.length=bt.length,xt=!0}}else $[0]!==i.BACK&&($[0]=i.BACK,xt=!0);xt&&i.drawBuffers($)}function ne(N){return y!==N?(i.useProgram(N),y=N,!0):!1}let kt={[xi]:i.FUNC_ADD,[Ah]:i.FUNC_SUBTRACT,[Rh]:i.FUNC_REVERSE_SUBTRACT};kt[Ch]=i.MIN,kt[Ph]=i.MAX;let j={[Ih]:i.ZERO,[Lh]:i.ONE,[Dh]:i.SRC_COLOR,[ra]:i.SRC_ALPHA,[zh]:i.SRC_ALPHA_SATURATE,[Oh]:i.DST_COLOR,[Uh]:i.DST_ALPHA,[Nh]:i.ONE_MINUS_SRC_COLOR,[aa]:i.ONE_MINUS_SRC_ALPHA,[Bh]:i.ONE_MINUS_DST_COLOR,[Fh]:i.ONE_MINUS_DST_ALPHA,[kh]:i.CONSTANT_COLOR,[Vh]:i.ONE_MINUS_CONSTANT_COLOR,[Hh]:i.CONSTANT_ALPHA,[Gh]:i.ONE_MINUS_CONSTANT_ALPHA};function rt(N,ft,$,xt,bt,nt,Lt,Ct,Ae,_e){if(N===Vn){p===!0&&(pt(i.BLEND),p=!1);return}if(p===!1&&(tt(i.BLEND),p=!0),N!==wh){if(N!==g||_e!==P){if((S!==xi||w!==xi)&&(i.blendEquation(i.FUNC_ADD),S=xi,w=xi),_e)switch(N){case jn:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case kl:i.blendFunc(i.ONE,i.ONE);break;case Vl:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case Hl:i.blendFuncSeparate(i.DST_COLOR,i.ONE_MINUS_SRC_ALPHA,i.ZERO,i.ONE);break;default:Ht("WebGLState: Invalid blending: ",N);break}else switch(N){case jn:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case kl:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE,i.ONE,i.ONE);break;case Vl:Ht("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Hl:Ht("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Ht("WebGLState: Invalid blending: ",N);break}b=null,v=null,T=null,R=null,_.set(0,0,0),E=0,g=N,P=_e}return}bt=bt||ft,nt=nt||$,Lt=Lt||xt,(ft!==S||bt!==w)&&(i.blendEquationSeparate(kt[ft],kt[bt]),S=ft,w=bt),($!==b||xt!==v||nt!==T||Lt!==R)&&(i.blendFuncSeparate(j[$],j[xt],j[nt],j[Lt]),b=$,v=xt,T=nt,R=Lt),(Ct.equals(_)===!1||Ae!==E)&&(i.blendColor(Ct.r,Ct.g,Ct.b,Ae),_.copy(Ct),E=Ae),g=N,P=!1}function st(N,ft){N.side===qe?pt(i.CULL_FACE):tt(i.CULL_FACE);let $=N.side===rn;ft&&($=!$),mt($),N.blending===jn&&N.transparent===!1?rt(Vn):rt(N.blending,N.blendEquation,N.blendSrc,N.blendDst,N.blendEquationAlpha,N.blendSrcAlpha,N.blendDstAlpha,N.blendColor,N.blendAlpha,N.premultipliedAlpha),a.setFunc(N.depthFunc),a.setTest(N.depthTest),a.setMask(N.depthWrite),r.setMask(N.colorWrite);let xt=N.stencilWrite;o.setTest(xt),xt&&(o.setMask(N.stencilWriteMask),o.setFunc(N.stencilFunc,N.stencilRef,N.stencilFuncMask),o.setOp(N.stencilFail,N.stencilZFail,N.stencilZPass)),Rt(N.polygonOffset,N.polygonOffsetFactor,N.polygonOffsetUnits),N.alphaToCoverage===!0?tt(i.SAMPLE_ALPHA_TO_COVERAGE):pt(i.SAMPLE_ALPHA_TO_COVERAGE)}function mt(N){C!==N&&(N?i.frontFace(i.CW):i.frontFace(i.CCW),C=N)}function ut(N){N!==bh?(tt(i.CULL_FACE),N!==D&&(N===zl?i.cullFace(i.BACK):N===Th?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):pt(i.CULL_FACE),D=N}function Ot(N){N!==W&&(V&&i.lineWidth(N),W=N)}function Rt(N,ft,$){N?(tt(i.POLYGON_OFFSET_FILL),(X!==ft||O!==$)&&(X=ft,O=$,a.getReversed()&&(ft=-ft),i.polygonOffset(ft,$))):pt(i.POLYGON_OFFSET_FILL)}function Vt(N){N?tt(i.SCISSOR_TEST):pt(i.SCISSOR_TEST)}function Xt(N){N===void 0&&(N=i.TEXTURE0+H-1),ot!==N&&(i.activeTexture(N),ot=N)}function L(N,ft,$){$===void 0&&(ot===null?$=i.TEXTURE0+H-1:$=ot);let xt=ct[$];xt===void 0&&(xt={type:void 0,texture:void 0},ct[$]=xt),(xt.type!==N||xt.texture!==ft)&&(ot!==$&&(i.activeTexture($),ot=$),i.bindTexture(N,ft||at[N]),xt.type=N,xt.texture=ft)}function ue(){let N=ct[ot];N!==void 0&&N.type!==void 0&&(i.bindTexture(N.type,null),N.type=void 0,N.texture=void 0)}function te(){try{i.compressedTexImage2D(...arguments)}catch(N){Ht("WebGLState:",N)}}function A(){try{i.compressedTexImage3D(...arguments)}catch(N){Ht("WebGLState:",N)}}function x(){try{i.texSubImage2D(...arguments)}catch(N){Ht("WebGLState:",N)}}function F(){try{i.texSubImage3D(...arguments)}catch(N){Ht("WebGLState:",N)}}function k(){try{i.compressedTexSubImage2D(...arguments)}catch(N){Ht("WebGLState:",N)}}function q(){try{i.compressedTexSubImage3D(...arguments)}catch(N){Ht("WebGLState:",N)}}function lt(){try{i.texStorage2D(...arguments)}catch(N){Ht("WebGLState:",N)}}function dt(){try{i.texStorage3D(...arguments)}catch(N){Ht("WebGLState:",N)}}function Y(){try{i.texImage2D(...arguments)}catch(N){Ht("WebGLState:",N)}}function Q(){try{i.texImage3D(...arguments)}catch(N){Ht("WebGLState:",N)}}function gt(N){return d[N]!==void 0?d[N]:i.getParameter(N)}function Dt(N,ft){d[N]!==ft&&(i.pixelStorei(N,ft),d[N]=ft)}function vt(N){$t.equals(N)===!1&&(i.scissor(N.x,N.y,N.z,N.w),$t.copy(N))}function _t(N){Zt.equals(N)===!1&&(i.viewport(N.x,N.y,N.z,N.w),Zt.copy(N))}function Bt(N,ft){let $=c.get(ft);$===void 0&&($=new WeakMap,c.set(ft,$));let xt=$.get(N);xt===void 0&&(xt=i.getUniformBlockIndex(ft,N.name),$.set(N,xt))}function Wt(N,ft){let xt=c.get(ft).get(N);l.get(ft)!==xt&&(i.uniformBlockBinding(ft,xt,N.__bindingPointIndex),l.set(ft,xt))}function Kt(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),a.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),i.pixelStorei(i.PACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,!1),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,i.BROWSER_DEFAULT_WEBGL),i.pixelStorei(i.PACK_ROW_LENGTH,0),i.pixelStorei(i.PACK_SKIP_PIXELS,0),i.pixelStorei(i.PACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_ROW_LENGTH,0),i.pixelStorei(i.UNPACK_IMAGE_HEIGHT,0),i.pixelStorei(i.UNPACK_SKIP_PIXELS,0),i.pixelStorei(i.UNPACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_SKIP_IMAGES,0),h={},d={},ot=null,ct={},u={},f=new WeakMap,m=[],y=null,p=!1,g=null,S=null,b=null,v=null,w=null,T=null,R=null,_=new Yt(0,0,0),E=0,P=!1,C=null,D=null,W=null,X=null,O=null,$t.set(0,0,i.canvas.width,i.canvas.height),Zt.set(0,0,i.canvas.width,i.canvas.height),r.reset(),a.reset(),o.reset()}return{buffers:{color:r,depth:a,stencil:o},enable:tt,disable:pt,bindFramebuffer:Ft,drawBuffers:Pt,useProgram:ne,setBlending:rt,setMaterial:st,setFlipSided:mt,setCullFace:ut,setLineWidth:Ot,setPolygonOffset:Rt,setScissorTest:Vt,activeTexture:Xt,bindTexture:L,unbindTexture:ue,compressedTexImage2D:te,compressedTexImage3D:A,texImage2D:Y,texImage3D:Q,pixelStorei:Dt,getParameter:gt,updateUBOMapping:Bt,uniformBlockBinding:Wt,texStorage2D:lt,texStorage3D:dt,texSubImage2D:x,texSubImage3D:F,compressedTexSubImage2D:k,compressedTexSubImage3D:q,scissor:vt,viewport:_t,reset:Kt}}function n_(i,t,e,n,s,r,a){let o=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator=="undefined"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new ht,h=new WeakMap,d=new Set,u,f=new WeakMap,m=!1;try{m=typeof OffscreenCanvas!="undefined"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function y(A,x){return m?new OffscreenCanvas(A,x):Ks("canvas")}function p(A,x,F){let k=1,q=te(A);if((q.width>F||q.height>F)&&(k=F/Math.max(q.width,q.height)),k<1)if(typeof HTMLImageElement!="undefined"&&A instanceof HTMLImageElement||typeof HTMLCanvasElement!="undefined"&&A instanceof HTMLCanvasElement||typeof ImageBitmap!="undefined"&&A instanceof ImageBitmap||typeof VideoFrame!="undefined"&&A instanceof VideoFrame){let lt=Math.floor(k*q.width),dt=Math.floor(k*q.height);u===void 0&&(u=y(lt,dt));let Y=x?y(lt,dt):u;return Y.width=lt,Y.height=dt,Y.getContext("2d").drawImage(A,0,0,lt,dt),Gt("WebGLRenderer: Texture has been resized from ("+q.width+"x"+q.height+") to ("+lt+"x"+dt+")."),Y}else return"data"in A&&Gt("WebGLRenderer: Image in DataTexture is too big ("+q.width+"x"+q.height+")."),A;return A}function g(A){return A.generateMipmaps}function S(A){i.generateMipmap(A)}function b(A){return A.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:A.isWebGL3DRenderTarget?i.TEXTURE_3D:A.isWebGLArrayRenderTarget||A.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function v(A,x,F,k,q,lt=!1){if(A!==null){if(i[A]!==void 0)return i[A];Gt("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+A+"'")}let dt;k&&(dt=t.get("EXT_texture_norm16"),dt||Gt("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let Y=x;if(x===i.RED&&(F===i.FLOAT&&(Y=i.R32F),F===i.HALF_FLOAT&&(Y=i.R16F),F===i.UNSIGNED_BYTE&&(Y=i.R8),F===i.UNSIGNED_SHORT&&dt&&(Y=dt.R16_EXT),F===i.SHORT&&dt&&(Y=dt.R16_SNORM_EXT)),x===i.RED_INTEGER&&(F===i.UNSIGNED_BYTE&&(Y=i.R8UI),F===i.UNSIGNED_SHORT&&(Y=i.R16UI),F===i.UNSIGNED_INT&&(Y=i.R32UI),F===i.BYTE&&(Y=i.R8I),F===i.SHORT&&(Y=i.R16I),F===i.INT&&(Y=i.R32I)),x===i.RG&&(F===i.FLOAT&&(Y=i.RG32F),F===i.HALF_FLOAT&&(Y=i.RG16F),F===i.UNSIGNED_BYTE&&(Y=i.RG8),F===i.UNSIGNED_SHORT&&dt&&(Y=dt.RG16_EXT),F===i.SHORT&&dt&&(Y=dt.RG16_SNORM_EXT)),x===i.RG_INTEGER&&(F===i.UNSIGNED_BYTE&&(Y=i.RG8UI),F===i.UNSIGNED_SHORT&&(Y=i.RG16UI),F===i.UNSIGNED_INT&&(Y=i.RG32UI),F===i.BYTE&&(Y=i.RG8I),F===i.SHORT&&(Y=i.RG16I),F===i.INT&&(Y=i.RG32I)),x===i.RGB_INTEGER&&(F===i.UNSIGNED_BYTE&&(Y=i.RGB8UI),F===i.UNSIGNED_SHORT&&(Y=i.RGB16UI),F===i.UNSIGNED_INT&&(Y=i.RGB32UI),F===i.BYTE&&(Y=i.RGB8I),F===i.SHORT&&(Y=i.RGB16I),F===i.INT&&(Y=i.RGB32I)),x===i.RGBA_INTEGER&&(F===i.UNSIGNED_BYTE&&(Y=i.RGBA8UI),F===i.UNSIGNED_SHORT&&(Y=i.RGBA16UI),F===i.UNSIGNED_INT&&(Y=i.RGBA32UI),F===i.BYTE&&(Y=i.RGBA8I),F===i.SHORT&&(Y=i.RGBA16I),F===i.INT&&(Y=i.RGBA32I)),x===i.RGB&&(F===i.UNSIGNED_SHORT&&dt&&(Y=dt.RGB16_EXT),F===i.SHORT&&dt&&(Y=dt.RGB16_SNORM_EXT),F===i.UNSIGNED_INT_5_9_9_9_REV&&(Y=i.RGB9_E5),F===i.UNSIGNED_INT_10F_11F_11F_REV&&(Y=i.R11F_G11F_B10F)),x===i.RGBA){let Q=lt?Zs:se.getTransfer(q);F===i.FLOAT&&(Y=i.RGBA32F),F===i.HALF_FLOAT&&(Y=i.RGBA16F),F===i.UNSIGNED_BYTE&&(Y=Q===de?i.SRGB8_ALPHA8:i.RGBA8),F===i.UNSIGNED_SHORT&&dt&&(Y=dt.RGBA16_EXT),F===i.SHORT&&dt&&(Y=dt.RGBA16_SNORM_EXT),F===i.UNSIGNED_SHORT_4_4_4_4&&(Y=i.RGBA4),F===i.UNSIGNED_SHORT_5_5_5_1&&(Y=i.RGB5_A1)}return(Y===i.R16F||Y===i.R32F||Y===i.RG16F||Y===i.RG32F||Y===i.RGBA16F||Y===i.RGBA32F)&&t.get("EXT_color_buffer_float"),Y}function w(A,x){let F;return A?x===null||x===Pn||x===As?F=i.DEPTH24_STENCIL8:x===In?F=i.DEPTH32F_STENCIL8:x===ws&&(F=i.DEPTH24_STENCIL8,Gt("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):x===null||x===Pn||x===As?F=i.DEPTH_COMPONENT24:x===In?F=i.DEPTH_COMPONENT32F:x===ws&&(F=i.DEPTH_COMPONENT16),F}function T(A,x){return g(A)===!0||A.isFramebufferTexture&&A.minFilter!==ke&&A.minFilter!==Xe?Math.log2(Math.max(x.width,x.height))+1:A.mipmaps!==void 0&&A.mipmaps.length>0?A.mipmaps.length:A.isCompressedTexture&&Array.isArray(A.image)?x.mipmaps.length:1}function R(A){let x=A.target;x.removeEventListener("dispose",R),E(x),x.isVideoTexture&&h.delete(x),x.isHTMLTexture&&d.delete(x)}function _(A){let x=A.target;x.removeEventListener("dispose",_),C(x)}function E(A){let x=n.get(A);if(x.__webglInit===void 0)return;let F=A.source,k=f.get(F);if(k){let q=k[x.__cacheKey];q.usedTimes--,q.usedTimes===0&&P(A),Object.keys(k).length===0&&f.delete(F)}n.remove(A)}function P(A){let x=n.get(A);i.deleteTexture(x.__webglTexture);let F=A.source,k=f.get(F);delete k[x.__cacheKey],a.memory.textures--}function C(A){let x=n.get(A);if(A.depthTexture&&(A.depthTexture.dispose(),n.remove(A.depthTexture)),A.isWebGLCubeRenderTarget)for(let k=0;k<6;k++){if(Array.isArray(x.__webglFramebuffer[k]))for(let q=0;q<x.__webglFramebuffer[k].length;q++)i.deleteFramebuffer(x.__webglFramebuffer[k][q]);else i.deleteFramebuffer(x.__webglFramebuffer[k]);x.__webglDepthbuffer&&i.deleteRenderbuffer(x.__webglDepthbuffer[k])}else{if(Array.isArray(x.__webglFramebuffer))for(let k=0;k<x.__webglFramebuffer.length;k++)i.deleteFramebuffer(x.__webglFramebuffer[k]);else i.deleteFramebuffer(x.__webglFramebuffer);if(x.__webglDepthbuffer&&i.deleteRenderbuffer(x.__webglDepthbuffer),x.__webglMultisampledFramebuffer&&i.deleteFramebuffer(x.__webglMultisampledFramebuffer),x.__webglColorRenderbuffer)for(let k=0;k<x.__webglColorRenderbuffer.length;k++)x.__webglColorRenderbuffer[k]&&i.deleteRenderbuffer(x.__webglColorRenderbuffer[k]);x.__webglDepthRenderbuffer&&i.deleteRenderbuffer(x.__webglDepthRenderbuffer)}let F=A.textures;for(let k=0,q=F.length;k<q;k++){let lt=n.get(F[k]);lt.__webglTexture&&(i.deleteTexture(lt.__webglTexture),a.memory.textures--),n.remove(F[k])}n.remove(A)}let D=0;function W(){D=0}function X(){return D}function O(A){D=A}function H(){let A=D;return A>=s.maxTextures&&Gt("WebGLTextures: Trying to use "+A+" texture units while this GPU supports only "+s.maxTextures),D+=1,A}function V(A){let x=[];return x.push(A.wrapS),x.push(A.wrapT),x.push(A.wrapR||0),x.push(A.magFilter),x.push(A.minFilter),x.push(A.anisotropy),x.push(A.internalFormat),x.push(A.format),x.push(A.type),x.push(A.generateMipmaps),x.push(A.premultiplyAlpha),x.push(A.flipY),x.push(A.unpackAlignment),x.push(A.colorSpace),x.join()}function K(A,x){let F=n.get(A);if(A.isVideoTexture&&L(A),A.isRenderTargetTexture===!1&&A.isExternalTexture!==!0&&A.version>0&&F.__version!==A.version){let k=A.image;if(k===null)Gt("WebGLRenderer: Texture marked for update but no image data found.");else if(k.complete===!1)Gt("WebGLRenderer: Texture marked for update but image is incomplete");else{pt(F,A,x);return}}else A.isExternalTexture&&(F.__webglTexture=A.sourceTexture?A.sourceTexture:null);e.bindTexture(i.TEXTURE_2D,F.__webglTexture,i.TEXTURE0+x)}function et(A,x){let F=n.get(A);if(A.isRenderTargetTexture===!1&&A.version>0&&F.__version!==A.version){pt(F,A,x);return}else A.isExternalTexture&&(F.__webglTexture=A.sourceTexture?A.sourceTexture:null);e.bindTexture(i.TEXTURE_2D_ARRAY,F.__webglTexture,i.TEXTURE0+x)}function ot(A,x){let F=n.get(A);if(A.isRenderTargetTexture===!1&&A.version>0&&F.__version!==A.version){pt(F,A,x);return}e.bindTexture(i.TEXTURE_3D,F.__webglTexture,i.TEXTURE0+x)}function ct(A,x){let F=n.get(A);if(A.isCubeDepthTexture!==!0&&A.version>0&&F.__version!==A.version){Ft(F,A,x);return}e.bindTexture(i.TEXTURE_CUBE_MAP,F.__webglTexture,i.TEXTURE0+x)}let it={[ti]:i.REPEAT,[Fn]:i.CLAMP_TO_EDGE,[pa]:i.MIRRORED_REPEAT},zt={[ke]:i.NEAREST,[qh]:i.NEAREST_MIPMAP_NEAREST,[Sr]:i.NEAREST_MIPMAP_LINEAR,[Xe]:i.LINEAR,[Xa]:i.LINEAR_MIPMAP_NEAREST,[Ei]:i.LINEAR_MIPMAP_LINEAR},$t={[Kh]:i.NEVER,[tu]:i.ALWAYS,[Jh]:i.LESS,[Po]:i.LEQUAL,[$h]:i.EQUAL,[Io]:i.GEQUAL,[Qh]:i.GREATER,[jh]:i.NOTEQUAL};function Zt(A,x){if(x.type===In&&t.has("OES_texture_float_linear")===!1&&(x.magFilter===Xe||x.magFilter===Xa||x.magFilter===Sr||x.magFilter===Ei||x.minFilter===Xe||x.minFilter===Xa||x.minFilter===Sr||x.minFilter===Ei)&&Gt("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(A,i.TEXTURE_WRAP_S,it[x.wrapS]),i.texParameteri(A,i.TEXTURE_WRAP_T,it[x.wrapT]),(A===i.TEXTURE_3D||A===i.TEXTURE_2D_ARRAY)&&i.texParameteri(A,i.TEXTURE_WRAP_R,it[x.wrapR]),i.texParameteri(A,i.TEXTURE_MAG_FILTER,zt[x.magFilter]),i.texParameteri(A,i.TEXTURE_MIN_FILTER,zt[x.minFilter]),x.compareFunction&&(i.texParameteri(A,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(A,i.TEXTURE_COMPARE_FUNC,$t[x.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(x.magFilter===ke||x.minFilter!==Sr&&x.minFilter!==Ei||x.type===In&&t.has("OES_texture_float_linear")===!1)return;if(x.anisotropy>1||n.get(x).__currentAnisotropy){let F=t.get("EXT_texture_filter_anisotropic");i.texParameterf(A,F.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(x.anisotropy,s.getMaxAnisotropy())),n.get(x).__currentAnisotropy=x.anisotropy}}}function Z(A,x){let F=!1;A.__webglInit===void 0&&(A.__webglInit=!0,x.addEventListener("dispose",R));let k=x.source,q=f.get(k);q===void 0&&(q={},f.set(k,q));let lt=V(x);if(lt!==A.__cacheKey){q[lt]===void 0&&(q[lt]={texture:i.createTexture(),usedTimes:0},a.memory.textures++,F=!0),q[lt].usedTimes++;let dt=q[A.__cacheKey];dt!==void 0&&(q[A.__cacheKey].usedTimes--,dt.usedTimes===0&&P(x)),A.__cacheKey=lt,A.__webglTexture=q[lt].texture}return F}function at(A,x,F){return Math.floor(Math.floor(A/F)/x)}function tt(A,x,F,k){let lt=A.updateRanges;if(lt.length===0)e.texSubImage2D(i.TEXTURE_2D,0,0,0,x.width,x.height,F,k,x.data);else{lt.sort((Dt,vt)=>Dt.start-vt.start);let dt=0;for(let Dt=1;Dt<lt.length;Dt++){let vt=lt[dt],_t=lt[Dt],Bt=vt.start+vt.count,Wt=at(_t.start,x.width,4),Kt=at(vt.start,x.width,4);_t.start<=Bt+1&&Wt===Kt&&at(_t.start+_t.count-1,x.width,4)===Wt?vt.count=Math.max(vt.count,_t.start+_t.count-vt.start):(++dt,lt[dt]=_t)}lt.length=dt+1;let Y=e.getParameter(i.UNPACK_ROW_LENGTH),Q=e.getParameter(i.UNPACK_SKIP_PIXELS),gt=e.getParameter(i.UNPACK_SKIP_ROWS);e.pixelStorei(i.UNPACK_ROW_LENGTH,x.width);for(let Dt=0,vt=lt.length;Dt<vt;Dt++){let _t=lt[Dt],Bt=Math.floor(_t.start/4),Wt=Math.ceil(_t.count/4),Kt=Bt%x.width,N=Math.floor(Bt/x.width),ft=Wt,$=1;e.pixelStorei(i.UNPACK_SKIP_PIXELS,Kt),e.pixelStorei(i.UNPACK_SKIP_ROWS,N),e.texSubImage2D(i.TEXTURE_2D,0,Kt,N,ft,$,F,k,x.data)}A.clearUpdateRanges(),e.pixelStorei(i.UNPACK_ROW_LENGTH,Y),e.pixelStorei(i.UNPACK_SKIP_PIXELS,Q),e.pixelStorei(i.UNPACK_SKIP_ROWS,gt)}}function pt(A,x,F){let k=i.TEXTURE_2D;(x.isDataArrayTexture||x.isCompressedArrayTexture)&&(k=i.TEXTURE_2D_ARRAY),x.isData3DTexture&&(k=i.TEXTURE_3D);let q=Z(A,x),lt=x.source;e.bindTexture(k,A.__webglTexture,i.TEXTURE0+F);let dt=n.get(lt);if(lt.version!==dt.__version||q===!0){if(e.activeTexture(i.TEXTURE0+F),(typeof ImageBitmap!="undefined"&&x.image instanceof ImageBitmap)===!1){let $=se.getPrimaries(se.workingColorSpace),xt=x.colorSpace===ai?null:se.getPrimaries(x.colorSpace),bt=x.colorSpace===ai||$===xt?i.NONE:i.BROWSER_DEFAULT_WEBGL;e.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,x.flipY),e.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),e.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,bt)}e.pixelStorei(i.UNPACK_ALIGNMENT,x.unpackAlignment);let Q=p(x.image,!1,s.maxTextureSize);Q=ue(x,Q);let gt=r.convert(x.format,x.colorSpace),Dt=r.convert(x.type),vt=v(x.internalFormat,gt,Dt,x.normalized,x.colorSpace,x.isVideoTexture);Zt(k,x);let _t,Bt=x.mipmaps,Wt=x.isVideoTexture!==!0,Kt=dt.__version===void 0||q===!0,N=lt.dataReady,ft=T(x,Q);if(x.isDepthTexture)vt=w(x.format===wi,x.type),Kt&&(Wt?e.texStorage2D(i.TEXTURE_2D,1,vt,Q.width,Q.height):e.texImage2D(i.TEXTURE_2D,0,vt,Q.width,Q.height,0,gt,Dt,null));else if(x.isDataTexture)if(Bt.length>0){Wt&&Kt&&e.texStorage2D(i.TEXTURE_2D,ft,vt,Bt[0].width,Bt[0].height);for(let $=0,xt=Bt.length;$<xt;$++)_t=Bt[$],Wt?N&&e.texSubImage2D(i.TEXTURE_2D,$,0,0,_t.width,_t.height,gt,Dt,_t.data):e.texImage2D(i.TEXTURE_2D,$,vt,_t.width,_t.height,0,gt,Dt,_t.data);x.generateMipmaps=!1}else Wt?(Kt&&e.texStorage2D(i.TEXTURE_2D,ft,vt,Q.width,Q.height),N&&tt(x,Q,gt,Dt)):e.texImage2D(i.TEXTURE_2D,0,vt,Q.width,Q.height,0,gt,Dt,Q.data);else if(x.isCompressedTexture)if(x.isCompressedArrayTexture){Wt&&Kt&&e.texStorage3D(i.TEXTURE_2D_ARRAY,ft,vt,Bt[0].width,Bt[0].height,Q.depth);for(let $=0,xt=Bt.length;$<xt;$++)if(_t=Bt[$],x.format!==Mn)if(gt!==null)if(Wt){if(N)if(x.layerUpdates.size>0){let bt=hc(_t.width,_t.height,x.format,x.type);for(let nt of x.layerUpdates){let Lt=_t.data.subarray(nt*bt/_t.data.BYTES_PER_ELEMENT,(nt+1)*bt/_t.data.BYTES_PER_ELEMENT);e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,$,0,0,nt,_t.width,_t.height,1,gt,Lt)}x.clearLayerUpdates()}else e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,$,0,0,0,_t.width,_t.height,Q.depth,gt,_t.data)}else e.compressedTexImage3D(i.TEXTURE_2D_ARRAY,$,vt,_t.width,_t.height,Q.depth,0,_t.data,0,0);else Gt("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Wt?N&&e.texSubImage3D(i.TEXTURE_2D_ARRAY,$,0,0,0,_t.width,_t.height,Q.depth,gt,Dt,_t.data):e.texImage3D(i.TEXTURE_2D_ARRAY,$,vt,_t.width,_t.height,Q.depth,0,gt,Dt,_t.data)}else{Wt&&Kt&&e.texStorage2D(i.TEXTURE_2D,ft,vt,Bt[0].width,Bt[0].height);for(let $=0,xt=Bt.length;$<xt;$++)_t=Bt[$],x.format!==Mn?gt!==null?Wt?N&&e.compressedTexSubImage2D(i.TEXTURE_2D,$,0,0,_t.width,_t.height,gt,_t.data):e.compressedTexImage2D(i.TEXTURE_2D,$,vt,_t.width,_t.height,0,_t.data):Gt("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Wt?N&&e.texSubImage2D(i.TEXTURE_2D,$,0,0,_t.width,_t.height,gt,Dt,_t.data):e.texImage2D(i.TEXTURE_2D,$,vt,_t.width,_t.height,0,gt,Dt,_t.data)}else if(x.isDataArrayTexture)if(Wt){if(Kt&&e.texStorage3D(i.TEXTURE_2D_ARRAY,ft,vt,Q.width,Q.height,Q.depth),N)if(x.layerUpdates.size>0){let $=hc(Q.width,Q.height,x.format,x.type);for(let xt of x.layerUpdates){let bt=Q.data.subarray(xt*$/Q.data.BYTES_PER_ELEMENT,(xt+1)*$/Q.data.BYTES_PER_ELEMENT);e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,xt,Q.width,Q.height,1,gt,Dt,bt)}x.clearLayerUpdates()}else e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,Q.width,Q.height,Q.depth,gt,Dt,Q.data)}else e.texImage3D(i.TEXTURE_2D_ARRAY,0,vt,Q.width,Q.height,Q.depth,0,gt,Dt,Q.data);else if(x.isData3DTexture)Wt?(Kt&&e.texStorage3D(i.TEXTURE_3D,ft,vt,Q.width,Q.height,Q.depth),N&&e.texSubImage3D(i.TEXTURE_3D,0,0,0,0,Q.width,Q.height,Q.depth,gt,Dt,Q.data)):e.texImage3D(i.TEXTURE_3D,0,vt,Q.width,Q.height,Q.depth,0,gt,Dt,Q.data);else if(x.isFramebufferTexture){if(Kt)if(Wt)e.texStorage2D(i.TEXTURE_2D,ft,vt,Q.width,Q.height);else{let $=Q.width,xt=Q.height;for(let bt=0;bt<ft;bt++)e.texImage2D(i.TEXTURE_2D,bt,vt,$,xt,0,gt,Dt,null),$>>=1,xt>>=1}}else if(x.isHTMLTexture){if("texElementImage2D"in i){let $=i.canvas;if($.hasAttribute("layoutsubtree")||$.setAttribute("layoutsubtree","true"),Q.parentNode!==$){$.appendChild(Q),d.add(x),$.onpaint=xt=>{let bt=xt.changedElements;for(let nt of d)bt.includes(nt.image)&&(nt.needsUpdate=!0)},$.requestPaint();return}if(i.texElementImage2D.length===3)i.texElementImage2D(i.TEXTURE_2D,i.RGBA8,Q);else{let bt=i.RGBA,nt=i.RGBA,Lt=i.UNSIGNED_BYTE;i.texElementImage2D(i.TEXTURE_2D,0,bt,nt,Lt,Q)}i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE)}}else if(Bt.length>0){if(Wt&&Kt){let $=te(Bt[0]);e.texStorage2D(i.TEXTURE_2D,ft,vt,$.width,$.height)}for(let $=0,xt=Bt.length;$<xt;$++)_t=Bt[$],Wt?N&&e.texSubImage2D(i.TEXTURE_2D,$,0,0,gt,Dt,_t):e.texImage2D(i.TEXTURE_2D,$,vt,gt,Dt,_t);x.generateMipmaps=!1}else if(Wt){if(Kt){let $=te(Q);e.texStorage2D(i.TEXTURE_2D,ft,vt,$.width,$.height)}N&&e.texSubImage2D(i.TEXTURE_2D,0,0,0,gt,Dt,Q)}else e.texImage2D(i.TEXTURE_2D,0,vt,gt,Dt,Q);g(x)&&S(k),dt.__version=lt.version,x.onUpdate&&x.onUpdate(x)}A.__version=x.version}function Ft(A,x,F){if(x.image.length!==6)return;let k=Z(A,x),q=x.source;e.bindTexture(i.TEXTURE_CUBE_MAP,A.__webglTexture,i.TEXTURE0+F);let lt=n.get(q);if(q.version!==lt.__version||k===!0){e.activeTexture(i.TEXTURE0+F);let dt=se.getPrimaries(se.workingColorSpace),Y=x.colorSpace===ai?null:se.getPrimaries(x.colorSpace),Q=x.colorSpace===ai||dt===Y?i.NONE:i.BROWSER_DEFAULT_WEBGL;e.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,x.flipY),e.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),e.pixelStorei(i.UNPACK_ALIGNMENT,x.unpackAlignment),e.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,Q);let gt=x.isCompressedTexture||x.image[0].isCompressedTexture,Dt=x.image[0]&&x.image[0].isDataTexture,vt=[];for(let nt=0;nt<6;nt++)!gt&&!Dt?vt[nt]=p(x.image[nt],!0,s.maxCubemapSize):vt[nt]=Dt?x.image[nt].image:x.image[nt],vt[nt]=ue(x,vt[nt]);let _t=vt[0],Bt=r.convert(x.format,x.colorSpace),Wt=r.convert(x.type),Kt=v(x.internalFormat,Bt,Wt,x.normalized,x.colorSpace),N=x.isVideoTexture!==!0,ft=lt.__version===void 0||k===!0,$=q.dataReady,xt=T(x,_t);Zt(i.TEXTURE_CUBE_MAP,x);let bt;if(gt){N&&ft&&e.texStorage2D(i.TEXTURE_CUBE_MAP,xt,Kt,_t.width,_t.height);for(let nt=0;nt<6;nt++){bt=vt[nt].mipmaps;for(let Lt=0;Lt<bt.length;Lt++){let Ct=bt[Lt];x.format!==Mn?Bt!==null?N?$&&e.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+nt,Lt,0,0,Ct.width,Ct.height,Bt,Ct.data):e.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+nt,Lt,Kt,Ct.width,Ct.height,0,Ct.data):Gt("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):N?$&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+nt,Lt,0,0,Ct.width,Ct.height,Bt,Wt,Ct.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+nt,Lt,Kt,Ct.width,Ct.height,0,Bt,Wt,Ct.data)}}}else{if(bt=x.mipmaps,N&&ft){bt.length>0&&xt++;let nt=te(vt[0]);e.texStorage2D(i.TEXTURE_CUBE_MAP,xt,Kt,nt.width,nt.height)}for(let nt=0;nt<6;nt++)if(Dt){N?$&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+nt,0,0,0,vt[nt].width,vt[nt].height,Bt,Wt,vt[nt].data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+nt,0,Kt,vt[nt].width,vt[nt].height,0,Bt,Wt,vt[nt].data);for(let Lt=0;Lt<bt.length;Lt++){let Ae=bt[Lt].image[nt].image;N?$&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+nt,Lt+1,0,0,Ae.width,Ae.height,Bt,Wt,Ae.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+nt,Lt+1,Kt,Ae.width,Ae.height,0,Bt,Wt,Ae.data)}}else{N?$&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+nt,0,0,0,Bt,Wt,vt[nt]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+nt,0,Kt,Bt,Wt,vt[nt]);for(let Lt=0;Lt<bt.length;Lt++){let Ct=bt[Lt];N?$&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+nt,Lt+1,0,0,Bt,Wt,Ct.image[nt]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+nt,Lt+1,Kt,Bt,Wt,Ct.image[nt])}}}g(x)&&S(i.TEXTURE_CUBE_MAP),lt.__version=q.version,x.onUpdate&&x.onUpdate(x)}A.__version=x.version}function Pt(A,x,F,k,q,lt){let dt=r.convert(F.format,F.colorSpace),Y=r.convert(F.type),Q=v(F.internalFormat,dt,Y,F.normalized,F.colorSpace),gt=n.get(x),Dt=n.get(F);if(Dt.__renderTarget=x,!gt.__hasExternalTextures){let vt=Math.max(1,x.width>>lt),_t=Math.max(1,x.height>>lt);q===i.TEXTURE_3D||q===i.TEXTURE_2D_ARRAY?e.texImage3D(q,lt,Q,vt,_t,x.depth,0,dt,Y,null):e.texImage2D(q,lt,Q,vt,_t,0,dt,Y,null)}e.bindFramebuffer(i.FRAMEBUFFER,A),Xt(x)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,k,q,Dt.__webglTexture,0,Vt(x)):(q===i.TEXTURE_2D||q>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&q<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,k,q,Dt.__webglTexture,lt),e.bindFramebuffer(i.FRAMEBUFFER,null)}function ne(A,x,F){if(i.bindRenderbuffer(i.RENDERBUFFER,A),x.depthBuffer){let k=x.depthTexture,q=k&&k.isDepthTexture?k.type:null,lt=w(x.stencilBuffer,q),dt=x.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;Xt(x)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,Vt(x),lt,x.width,x.height):F?i.renderbufferStorageMultisample(i.RENDERBUFFER,Vt(x),lt,x.width,x.height):i.renderbufferStorage(i.RENDERBUFFER,lt,x.width,x.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,dt,i.RENDERBUFFER,A)}else{let k=x.textures;for(let q=0;q<k.length;q++){let lt=k[q],dt=r.convert(lt.format,lt.colorSpace),Y=r.convert(lt.type),Q=v(lt.internalFormat,dt,Y,lt.normalized,lt.colorSpace);Xt(x)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,Vt(x),Q,x.width,x.height):F?i.renderbufferStorageMultisample(i.RENDERBUFFER,Vt(x),Q,x.width,x.height):i.renderbufferStorage(i.RENDERBUFFER,Q,x.width,x.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function kt(A,x,F){let k=x.isWebGLCubeRenderTarget===!0;if(e.bindFramebuffer(i.FRAMEBUFFER,A),!(x.depthTexture&&x.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let q=n.get(x.depthTexture);if(q.__renderTarget=x,(!q.__webglTexture||x.depthTexture.image.width!==x.width||x.depthTexture.image.height!==x.height)&&(x.depthTexture.image.width=x.width,x.depthTexture.image.height=x.height,x.depthTexture.needsUpdate=!0),k){if(q.__webglInit===void 0&&(q.__webglInit=!0,x.depthTexture.addEventListener("dispose",R)),q.__webglTexture===void 0){q.__webglTexture=i.createTexture(),e.bindTexture(i.TEXTURE_CUBE_MAP,q.__webglTexture),Zt(i.TEXTURE_CUBE_MAP,x.depthTexture);let gt=r.convert(x.depthTexture.format),Dt=r.convert(x.depthTexture.type),vt;x.depthTexture.format===On?vt=i.DEPTH_COMPONENT24:x.depthTexture.format===wi&&(vt=i.DEPTH24_STENCIL8);for(let _t=0;_t<6;_t++)i.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+_t,0,vt,x.width,x.height,0,gt,Dt,null)}}else K(x.depthTexture,0);let lt=q.__webglTexture,dt=Vt(x),Y=k?i.TEXTURE_CUBE_MAP_POSITIVE_X+F:i.TEXTURE_2D,Q=x.depthTexture.format===wi?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;if(x.depthTexture.format===On)Xt(x)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,Q,Y,lt,0,dt):i.framebufferTexture2D(i.FRAMEBUFFER,Q,Y,lt,0);else if(x.depthTexture.format===wi)Xt(x)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,Q,Y,lt,0,dt):i.framebufferTexture2D(i.FRAMEBUFFER,Q,Y,lt,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function j(A){let x=n.get(A),F=A.isWebGLCubeRenderTarget===!0;if(x.__boundDepthTexture!==A.depthTexture){let k=A.depthTexture;if(x.__depthDisposeCallback&&x.__depthDisposeCallback(),k){let q=()=>{delete x.__boundDepthTexture,delete x.__depthDisposeCallback,k.removeEventListener("dispose",q)};k.addEventListener("dispose",q),x.__depthDisposeCallback=q}x.__boundDepthTexture=k}if(A.depthTexture&&!x.__autoAllocateDepthBuffer)if(F)for(let k=0;k<6;k++)kt(x.__webglFramebuffer[k],A,k);else{let k=A.texture.mipmaps;k&&k.length>0?kt(x.__webglFramebuffer[0],A,0):kt(x.__webglFramebuffer,A,0)}else if(F){x.__webglDepthbuffer=[];for(let k=0;k<6;k++)if(e.bindFramebuffer(i.FRAMEBUFFER,x.__webglFramebuffer[k]),x.__webglDepthbuffer[k]===void 0)x.__webglDepthbuffer[k]=i.createRenderbuffer(),ne(x.__webglDepthbuffer[k],A,!1);else{let q=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,lt=x.__webglDepthbuffer[k];i.bindRenderbuffer(i.RENDERBUFFER,lt),i.framebufferRenderbuffer(i.FRAMEBUFFER,q,i.RENDERBUFFER,lt)}}else{let k=A.texture.mipmaps;if(k&&k.length>0?e.bindFramebuffer(i.FRAMEBUFFER,x.__webglFramebuffer[0]):e.bindFramebuffer(i.FRAMEBUFFER,x.__webglFramebuffer),x.__webglDepthbuffer===void 0)x.__webglDepthbuffer=i.createRenderbuffer(),ne(x.__webglDepthbuffer,A,!1);else{let q=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,lt=x.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,lt),i.framebufferRenderbuffer(i.FRAMEBUFFER,q,i.RENDERBUFFER,lt)}}e.bindFramebuffer(i.FRAMEBUFFER,null)}function rt(A,x,F){let k=n.get(A);x!==void 0&&Pt(k.__webglFramebuffer,A,A.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),F!==void 0&&j(A)}function st(A){let x=A.texture,F=n.get(A),k=n.get(x);A.addEventListener("dispose",_);let q=A.textures,lt=A.isWebGLCubeRenderTarget===!0,dt=q.length>1;if(dt||(k.__webglTexture===void 0&&(k.__webglTexture=i.createTexture()),k.__version=x.version,a.memory.textures++),lt){F.__webglFramebuffer=[];for(let Y=0;Y<6;Y++)if(x.mipmaps&&x.mipmaps.length>0){F.__webglFramebuffer[Y]=[];for(let Q=0;Q<x.mipmaps.length;Q++)F.__webglFramebuffer[Y][Q]=i.createFramebuffer()}else F.__webglFramebuffer[Y]=i.createFramebuffer()}else{if(x.mipmaps&&x.mipmaps.length>0){F.__webglFramebuffer=[];for(let Y=0;Y<x.mipmaps.length;Y++)F.__webglFramebuffer[Y]=i.createFramebuffer()}else F.__webglFramebuffer=i.createFramebuffer();if(dt)for(let Y=0,Q=q.length;Y<Q;Y++){let gt=n.get(q[Y]);gt.__webglTexture===void 0&&(gt.__webglTexture=i.createTexture(),a.memory.textures++)}if(A.samples>0&&Xt(A)===!1){F.__webglMultisampledFramebuffer=i.createFramebuffer(),F.__webglColorRenderbuffer=[],e.bindFramebuffer(i.FRAMEBUFFER,F.__webglMultisampledFramebuffer);for(let Y=0;Y<q.length;Y++){let Q=q[Y];F.__webglColorRenderbuffer[Y]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,F.__webglColorRenderbuffer[Y]);let gt=r.convert(Q.format,Q.colorSpace),Dt=r.convert(Q.type),vt=v(Q.internalFormat,gt,Dt,Q.normalized,Q.colorSpace,A.isXRRenderTarget===!0),_t=Vt(A);i.renderbufferStorageMultisample(i.RENDERBUFFER,_t,vt,A.width,A.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+Y,i.RENDERBUFFER,F.__webglColorRenderbuffer[Y])}i.bindRenderbuffer(i.RENDERBUFFER,null),A.depthBuffer&&(F.__webglDepthRenderbuffer=i.createRenderbuffer(),ne(F.__webglDepthRenderbuffer,A,!0)),e.bindFramebuffer(i.FRAMEBUFFER,null)}}if(lt){e.bindTexture(i.TEXTURE_CUBE_MAP,k.__webglTexture),Zt(i.TEXTURE_CUBE_MAP,x);for(let Y=0;Y<6;Y++)if(x.mipmaps&&x.mipmaps.length>0)for(let Q=0;Q<x.mipmaps.length;Q++)Pt(F.__webglFramebuffer[Y][Q],A,x,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+Y,Q);else Pt(F.__webglFramebuffer[Y],A,x,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+Y,0);g(x)&&S(i.TEXTURE_CUBE_MAP),e.unbindTexture()}else if(dt){for(let Y=0,Q=q.length;Y<Q;Y++){let gt=q[Y],Dt=n.get(gt),vt=i.TEXTURE_2D;(A.isWebGL3DRenderTarget||A.isWebGLArrayRenderTarget)&&(vt=A.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),e.bindTexture(vt,Dt.__webglTexture),Zt(vt,gt),Pt(F.__webglFramebuffer,A,gt,i.COLOR_ATTACHMENT0+Y,vt,0),g(gt)&&S(vt)}e.unbindTexture()}else{let Y=i.TEXTURE_2D;if((A.isWebGL3DRenderTarget||A.isWebGLArrayRenderTarget)&&(Y=A.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),e.bindTexture(Y,k.__webglTexture),Zt(Y,x),x.mipmaps&&x.mipmaps.length>0)for(let Q=0;Q<x.mipmaps.length;Q++)Pt(F.__webglFramebuffer[Q],A,x,i.COLOR_ATTACHMENT0,Y,Q);else Pt(F.__webglFramebuffer,A,x,i.COLOR_ATTACHMENT0,Y,0);g(x)&&S(Y),e.unbindTexture()}A.depthBuffer&&j(A)}function mt(A){let x=A.textures;for(let F=0,k=x.length;F<k;F++){let q=x[F];if(g(q)){let lt=b(A),dt=n.get(q).__webglTexture;e.bindTexture(lt,dt),S(lt),e.unbindTexture()}}}let ut=[],Ot=[];function Rt(A){if(A.samples>0){if(Xt(A)===!1){let x=A.textures,F=A.width,k=A.height,q=i.COLOR_BUFFER_BIT,lt=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,dt=n.get(A),Y=x.length>1;if(Y)for(let gt=0;gt<x.length;gt++)e.bindFramebuffer(i.FRAMEBUFFER,dt.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+gt,i.RENDERBUFFER,null),e.bindFramebuffer(i.FRAMEBUFFER,dt.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+gt,i.TEXTURE_2D,null,0);e.bindFramebuffer(i.READ_FRAMEBUFFER,dt.__webglMultisampledFramebuffer);let Q=A.texture.mipmaps;Q&&Q.length>0?e.bindFramebuffer(i.DRAW_FRAMEBUFFER,dt.__webglFramebuffer[0]):e.bindFramebuffer(i.DRAW_FRAMEBUFFER,dt.__webglFramebuffer);for(let gt=0;gt<x.length;gt++){if(A.resolveDepthBuffer&&(A.depthBuffer&&(q|=i.DEPTH_BUFFER_BIT),A.stencilBuffer&&A.resolveStencilBuffer&&(q|=i.STENCIL_BUFFER_BIT)),Y){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,dt.__webglColorRenderbuffer[gt]);let Dt=n.get(x[gt]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,Dt,0)}i.blitFramebuffer(0,0,F,k,0,0,F,k,q,i.NEAREST),l===!0&&(ut.length=0,Ot.length=0,ut.push(i.COLOR_ATTACHMENT0+gt),A.depthBuffer&&A.resolveDepthBuffer===!1&&(ut.push(lt),Ot.push(lt),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,Ot)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,ut))}if(e.bindFramebuffer(i.READ_FRAMEBUFFER,null),e.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),Y)for(let gt=0;gt<x.length;gt++){e.bindFramebuffer(i.FRAMEBUFFER,dt.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+gt,i.RENDERBUFFER,dt.__webglColorRenderbuffer[gt]);let Dt=n.get(x[gt]).__webglTexture;e.bindFramebuffer(i.FRAMEBUFFER,dt.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+gt,i.TEXTURE_2D,Dt,0)}e.bindFramebuffer(i.DRAW_FRAMEBUFFER,dt.__webglMultisampledFramebuffer)}else if(A.depthBuffer&&A.resolveDepthBuffer===!1&&l){let x=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[x])}}}function Vt(A){return Math.min(s.maxSamples,A.samples)}function Xt(A){let x=n.get(A);return A.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&x.__useRenderToTexture!==!1}function L(A){let x=a.render.frame;h.get(A)!==x&&(h.set(A,x),A.update())}function ue(A,x){let F=A.colorSpace,k=A.format,q=A.type;return A.isCompressedTexture===!0||A.isVideoTexture===!0||F!==Ys&&F!==ai&&(se.getTransfer(F)===de?(k!==Mn||q!==on)&&Gt("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Ht("WebGLTextures: Unsupported texture color space:",F)),x}function te(A){return typeof HTMLImageElement!="undefined"&&A instanceof HTMLImageElement?(c.width=A.naturalWidth||A.width,c.height=A.naturalHeight||A.height):typeof VideoFrame!="undefined"&&A instanceof VideoFrame?(c.width=A.displayWidth,c.height=A.displayHeight):(c.width=A.width,c.height=A.height),c}this.allocateTextureUnit=H,this.resetTextureUnits=W,this.getTextureUnits=X,this.setTextureUnits=O,this.setTexture2D=K,this.setTexture2DArray=et,this.setTexture3D=ot,this.setTextureCube=ct,this.rebindTextures=rt,this.setupRenderTarget=st,this.updateRenderTargetMipmap=mt,this.updateMultisampleRenderTarget=Rt,this.setupDepthRenderbuffer=j,this.setupFrameBufferTexture=Pt,this.useMultisampledRTT=Xt,this.isReversedDepthBuffer=function(){return e.buffers.depth.getReversed()}}function i_(i,t){function e(n,s=ai){let r,a=se.getTransfer(s);if(n===on)return i.UNSIGNED_BYTE;if(n===Ya)return i.UNSIGNED_SHORT_4_4_4_4;if(n===Za)return i.UNSIGNED_SHORT_5_5_5_1;if(n===jl)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===tc)return i.UNSIGNED_INT_10F_11F_11F_REV;if(n===$l)return i.BYTE;if(n===Ql)return i.SHORT;if(n===ws)return i.UNSIGNED_SHORT;if(n===qa)return i.INT;if(n===Pn)return i.UNSIGNED_INT;if(n===In)return i.FLOAT;if(n===Hn)return i.HALF_FLOAT;if(n===ec)return i.ALPHA;if(n===nc)return i.RGB;if(n===Mn)return i.RGBA;if(n===On)return i.DEPTH_COMPONENT;if(n===wi)return i.DEPTH_STENCIL;if(n===ic)return i.RED;if(n===Ka)return i.RED_INTEGER;if(n===Ai)return i.RG;if(n===Ja)return i.RG_INTEGER;if(n===$a)return i.RGBA_INTEGER;if(n===br||n===Tr||n===Er||n===wr)if(a===de)if(r=t.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===br)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===Tr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===Er)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===wr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=t.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===br)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===Tr)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===Er)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===wr)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===Qa||n===ja||n===to||n===eo)if(r=t.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===Qa)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===ja)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===to)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===eo)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===no||n===io||n===so||n===ro||n===ao||n===Ar||n===oo)if(r=t.get("WEBGL_compressed_texture_etc"),r!==null){if(n===no||n===io)return a===de?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===so)return a===de?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC;if(n===ro)return r.COMPRESSED_R11_EAC;if(n===ao)return r.COMPRESSED_SIGNED_R11_EAC;if(n===Ar)return r.COMPRESSED_RG11_EAC;if(n===oo)return r.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===lo||n===co||n===ho||n===uo||n===fo||n===po||n===mo||n===go||n===_o||n===xo||n===vo||n===yo||n===Mo||n===So)if(r=t.get("WEBGL_compressed_texture_astc"),r!==null){if(n===lo)return a===de?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===co)return a===de?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===ho)return a===de?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===uo)return a===de?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===fo)return a===de?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===po)return a===de?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===mo)return a===de?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===go)return a===de?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===_o)return a===de?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===xo)return a===de?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===vo)return a===de?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===yo)return a===de?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===Mo)return a===de?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===So)return a===de?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===bo||n===To||n===Eo)if(r=t.get("EXT_texture_compression_bptc"),r!==null){if(n===bo)return a===de?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===To)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===Eo)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===wo||n===Ao||n===Rr||n===Ro)if(r=t.get("EXT_texture_compression_rgtc"),r!==null){if(n===wo)return r.COMPRESSED_RED_RGTC1_EXT;if(n===Ao)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===Rr)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===Ro)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===As?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:e}}var s_=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,r_=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,Cc=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,e){if(this.texture===null){let n=new sr(t.texture);(t.depthNear!==e.depthNear||t.depthFar!==e.depthFar)&&(this.depthNear=t.depthNear,this.depthFar=t.depthFar),this.texture=n}}getMesh(t){if(this.texture!==null&&this.mesh===null){let e=t.cameras[0].viewport,n=new sn({vertexShader:s_,fragmentShader:r_,uniforms:{depthColor:{value:this.texture},depthWidth:{value:e.z},depthHeight:{value:e.w}}});this.mesh=new Tt(new $e(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},Pc=class extends Bn{constructor(t,e){super();let n=this,s=null,r=1,a=null,o="local-floor",l=1,c=null,h=null,d=null,u=null,f=null,m=null,y=typeof XRWebGLBinding!="undefined",p=new Cc,g={},S=e.getContextAttributes(),b=null,v=null,w=[],T=[],R=new ht,_=null,E=new ze;E.viewport=new Te;let P=new ze;P.viewport=new Te;let C=[E,P],D=new Ha,W=null,X=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Z){let at=w[Z];return at===void 0&&(at=new gs,w[Z]=at),at.getTargetRaySpace()},this.getControllerGrip=function(Z){let at=w[Z];return at===void 0&&(at=new gs,w[Z]=at),at.getGripSpace()},this.getHand=function(Z){let at=w[Z];return at===void 0&&(at=new gs,w[Z]=at),at.getHandSpace()};function O(Z){let at=T.indexOf(Z.inputSource);if(at===-1)return;let tt=w[at];tt!==void 0&&(tt.update(Z.inputSource,Z.frame,c||a),tt.dispatchEvent({type:Z.type,data:Z.inputSource}))}function H(){s.removeEventListener("select",O),s.removeEventListener("selectstart",O),s.removeEventListener("selectend",O),s.removeEventListener("squeeze",O),s.removeEventListener("squeezestart",O),s.removeEventListener("squeezeend",O),s.removeEventListener("end",H),s.removeEventListener("inputsourceschange",V);for(let Z=0;Z<w.length;Z++){let at=T[Z];at!==null&&(T[Z]=null,w[Z].disconnect(at))}W=null,X=null,p.reset();for(let Z in g)delete g[Z];t.setRenderTarget(b),f=null,u=null,d=null,s=null,v=null,Zt.stop(),n.isPresenting=!1,t.setPixelRatio(_),t.setSize(R.width,R.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Z){r=Z,n.isPresenting===!0&&Gt("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Z){o=Z,n.isPresenting===!0&&Gt("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(Z){c=Z},this.getBaseLayer=function(){return u!==null?u:f},this.getBinding=function(){return d===null&&y&&(d=new XRWebGLBinding(s,e)),d},this.getFrame=function(){return m},this.getSession=function(){return s},this.setSession=async function(Z){if(s=Z,s!==null){if(b=t.getRenderTarget(),s.addEventListener("select",O),s.addEventListener("selectstart",O),s.addEventListener("selectend",O),s.addEventListener("squeeze",O),s.addEventListener("squeezestart",O),s.addEventListener("squeezeend",O),s.addEventListener("end",H),s.addEventListener("inputsourceschange",V),S.xrCompatible!==!0&&await e.makeXRCompatible(),_=t.getPixelRatio(),t.getSize(R),y&&"createProjectionLayer"in XRWebGLBinding.prototype){let tt=null,pt=null,Ft=null;S.depth&&(Ft=S.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,tt=S.stencil?wi:On,pt=S.stencil?As:Pn);let Pt={colorFormat:e.RGBA8,depthFormat:Ft,scaleFactor:r};d=this.getBinding(),u=d.createProjectionLayer(Pt),s.updateRenderState({layers:[u]}),t.setPixelRatio(1),t.setSize(u.textureWidth,u.textureHeight,!1),v=new fn(u.textureWidth,u.textureHeight,{format:Mn,type:on,depthTexture:new si(u.textureWidth,u.textureHeight,pt,void 0,void 0,void 0,void 0,void 0,void 0,tt),stencilBuffer:S.stencil,colorSpace:t.outputColorSpace,samples:S.antialias?4:0,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1})}else{let tt={antialias:S.antialias,alpha:!0,depth:S.depth,stencil:S.stencil,framebufferScaleFactor:r};f=new XRWebGLLayer(s,e,tt),s.updateRenderState({baseLayer:f}),t.setPixelRatio(1),t.setSize(f.framebufferWidth,f.framebufferHeight,!1),v=new fn(f.framebufferWidth,f.framebufferHeight,{format:Mn,type:on,colorSpace:t.outputColorSpace,stencilBuffer:S.stencil,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1})}v.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await s.requestReferenceSpace(o),Zt.setContext(s),Zt.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return p.getDepthTexture()};function V(Z){for(let at=0;at<Z.removed.length;at++){let tt=Z.removed[at],pt=T.indexOf(tt);pt>=0&&(T[pt]=null,w[pt].disconnect(tt))}for(let at=0;at<Z.added.length;at++){let tt=Z.added[at],pt=T.indexOf(tt);if(pt===-1){for(let Pt=0;Pt<w.length;Pt++)if(Pt>=T.length){T.push(tt),pt=Pt;break}else if(T[Pt]===null){T[Pt]=tt,pt=Pt;break}if(pt===-1)break}let Ft=w[pt];Ft&&Ft.connect(tt)}}let K=new I,et=new I;function ot(Z,at,tt){K.setFromMatrixPosition(at.matrixWorld),et.setFromMatrixPosition(tt.matrixWorld);let pt=K.distanceTo(et),Ft=at.projectionMatrix.elements,Pt=tt.projectionMatrix.elements,ne=Ft[14]/(Ft[10]-1),kt=Ft[14]/(Ft[10]+1),j=(Ft[9]+1)/Ft[5],rt=(Ft[9]-1)/Ft[5],st=(Ft[8]-1)/Ft[0],mt=(Pt[8]+1)/Pt[0],ut=ne*st,Ot=ne*mt,Rt=pt/(-st+mt),Vt=Rt*-st;if(at.matrixWorld.decompose(Z.position,Z.quaternion,Z.scale),Z.translateX(Vt),Z.translateZ(Rt),Z.matrixWorld.compose(Z.position,Z.quaternion,Z.scale),Z.matrixWorldInverse.copy(Z.matrixWorld).invert(),Ft[10]===-1)Z.projectionMatrix.copy(at.projectionMatrix),Z.projectionMatrixInverse.copy(at.projectionMatrixInverse);else{let Xt=ne+Rt,L=kt+Rt,ue=ut-Vt,te=Ot+(pt-Vt),A=j*kt/L*Xt,x=rt*kt/L*Xt;Z.projectionMatrix.makePerspective(ue,te,A,x,Xt,L),Z.projectionMatrixInverse.copy(Z.projectionMatrix).invert()}}function ct(Z,at){at===null?Z.matrixWorld.copy(Z.matrix):Z.matrixWorld.multiplyMatrices(at.matrixWorld,Z.matrix),Z.matrixWorldInverse.copy(Z.matrixWorld).invert()}this.updateCamera=function(Z){if(s===null)return;let at=Z.near,tt=Z.far;p.texture!==null&&(p.depthNear>0&&(at=p.depthNear),p.depthFar>0&&(tt=p.depthFar)),D.near=P.near=E.near=at,D.far=P.far=E.far=tt,(W!==D.near||X!==D.far)&&(s.updateRenderState({depthNear:D.near,depthFar:D.far}),W=D.near,X=D.far),D.layers.mask=Z.layers.mask|6,E.layers.mask=D.layers.mask&-5,P.layers.mask=D.layers.mask&-3;let pt=Z.parent,Ft=D.cameras;ct(D,pt);for(let Pt=0;Pt<Ft.length;Pt++)ct(Ft[Pt],pt);Ft.length===2?ot(D,E,P):D.projectionMatrix.copy(E.projectionMatrix),it(Z,D,pt)};function it(Z,at,tt){tt===null?Z.matrix.copy(at.matrixWorld):(Z.matrix.copy(tt.matrixWorld),Z.matrix.invert(),Z.matrix.multiply(at.matrixWorld)),Z.matrix.decompose(Z.position,Z.quaternion,Z.scale),Z.updateMatrixWorld(!0),Z.projectionMatrix.copy(at.projectionMatrix),Z.projectionMatrixInverse.copy(at.projectionMatrixInverse),Z.isPerspectiveCamera&&(Z.fov=Js*2*Math.atan(1/Z.projectionMatrix.elements[5]),Z.zoom=1)}this.getCamera=function(){return D},this.getFoveation=function(){if(!(u===null&&f===null))return l},this.setFoveation=function(Z){l=Z,u!==null&&(u.fixedFoveation=Z),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=Z)},this.hasDepthSensing=function(){return p.texture!==null},this.getDepthSensingMesh=function(){return p.getMesh(D)},this.getCameraTexture=function(Z){return g[Z]};let zt=null;function $t(Z,at){if(h=at.getViewerPose(c||a),m=at,h!==null){let tt=h.views;f!==null&&(t.setRenderTargetFramebuffer(v,f.framebuffer),t.setRenderTarget(v));let pt=!1;tt.length!==D.cameras.length&&(D.cameras.length=0,pt=!0);for(let kt=0;kt<tt.length;kt++){let j=tt[kt],rt=null;if(f!==null)rt=f.getViewport(j);else{let mt=d.getViewSubImage(u,j);rt=mt.viewport,kt===0&&(t.setRenderTargetTextures(v,mt.colorTexture,mt.depthStencilTexture),t.setRenderTarget(v))}let st=C[kt];st===void 0&&(st=new ze,st.layers.enable(kt),st.viewport=new Te,C[kt]=st),st.matrix.fromArray(j.transform.matrix),st.matrix.decompose(st.position,st.quaternion,st.scale),st.projectionMatrix.fromArray(j.projectionMatrix),st.projectionMatrixInverse.copy(st.projectionMatrix).invert(),st.viewport.set(rt.x,rt.y,rt.width,rt.height),kt===0&&(D.matrix.copy(st.matrix),D.matrix.decompose(D.position,D.quaternion,D.scale)),pt===!0&&D.cameras.push(st)}let Ft=s.enabledFeatures;if(Ft&&Ft.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&y){d=n.getBinding();let kt=d.getDepthInformation(tt[0]);kt&&kt.isValid&&kt.texture&&p.init(kt,s.renderState)}if(Ft&&Ft.includes("camera-access")&&y){t.state.unbindTexture(),d=n.getBinding();for(let kt=0;kt<tt.length;kt++){let j=tt[kt].camera;if(j){let rt=g[j];rt||(rt=new sr,g[j]=rt);let st=d.getCameraImage(j);rt.sourceTexture=st}}}}for(let tt=0;tt<w.length;tt++){let pt=T[tt],Ft=w[tt];pt!==null&&Ft!==void 0&&Ft.update(pt,at,c||a)}zt&&zt(Z,at),at.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:at}),m=null}let Zt=new Nu;Zt.setAnimationLoop($t),this.setAnimationLoop=function(Z){zt=Z},this.dispose=function(){}}},a_=new ve,ku=new qt;ku.set(-1,0,0,0,1,0,0,0,1);function o_(i,t){function e(p,g){p.matrixAutoUpdate===!0&&p.updateMatrix(),g.value.copy(p.matrix)}function n(p,g){g.color.getRGB(p.fogColor.value,oc(i)),g.isFog?(p.fogNear.value=g.near,p.fogFar.value=g.far):g.isFogExp2&&(p.fogDensity.value=g.density)}function s(p,g,S,b,v){g.isNodeMaterial?g.uniformsNeedUpdate=!1:g.isMeshBasicMaterial?r(p,g):g.isMeshLambertMaterial?(r(p,g),g.envMap&&(p.envMapIntensity.value=g.envMapIntensity)):g.isMeshToonMaterial?(r(p,g),d(p,g)):g.isMeshPhongMaterial?(r(p,g),h(p,g),g.envMap&&(p.envMapIntensity.value=g.envMapIntensity)):g.isMeshStandardMaterial?(r(p,g),u(p,g),g.isMeshPhysicalMaterial&&f(p,g,v)):g.isMeshMatcapMaterial?(r(p,g),m(p,g)):g.isMeshDepthMaterial?r(p,g):g.isMeshDistanceMaterial?(r(p,g),y(p,g)):g.isMeshNormalMaterial?r(p,g):g.isLineBasicMaterial?(a(p,g),g.isLineDashedMaterial&&o(p,g)):g.isPointsMaterial?l(p,g,S,b):g.isSpriteMaterial?c(p,g):g.isShadowMaterial?(p.color.value.copy(g.color),p.opacity.value=g.opacity):g.isShaderMaterial&&(g.uniformsNeedUpdate=!1)}function r(p,g){p.opacity.value=g.opacity,g.color&&p.diffuse.value.copy(g.color),g.emissive&&p.emissive.value.copy(g.emissive).multiplyScalar(g.emissiveIntensity),g.map&&(p.map.value=g.map,e(g.map,p.mapTransform)),g.alphaMap&&(p.alphaMap.value=g.alphaMap,e(g.alphaMap,p.alphaMapTransform)),g.bumpMap&&(p.bumpMap.value=g.bumpMap,e(g.bumpMap,p.bumpMapTransform),p.bumpScale.value=g.bumpScale,g.side===rn&&(p.bumpScale.value*=-1)),g.normalMap&&(p.normalMap.value=g.normalMap,e(g.normalMap,p.normalMapTransform),p.normalScale.value.copy(g.normalScale),g.side===rn&&p.normalScale.value.negate()),g.displacementMap&&(p.displacementMap.value=g.displacementMap,e(g.displacementMap,p.displacementMapTransform),p.displacementScale.value=g.displacementScale,p.displacementBias.value=g.displacementBias),g.emissiveMap&&(p.emissiveMap.value=g.emissiveMap,e(g.emissiveMap,p.emissiveMapTransform)),g.specularMap&&(p.specularMap.value=g.specularMap,e(g.specularMap,p.specularMapTransform)),g.alphaTest>0&&(p.alphaTest.value=g.alphaTest);let S=t.get(g),b=S.envMap,v=S.envMapRotation;b&&(p.envMap.value=b,p.envMapRotation.value.setFromMatrix4(a_.makeRotationFromEuler(v)).transpose(),b.isCubeTexture&&b.isRenderTargetTexture===!1&&p.envMapRotation.value.premultiply(ku),p.reflectivity.value=g.reflectivity,p.ior.value=g.ior,p.refractionRatio.value=g.refractionRatio),g.lightMap&&(p.lightMap.value=g.lightMap,p.lightMapIntensity.value=g.lightMapIntensity,e(g.lightMap,p.lightMapTransform)),g.aoMap&&(p.aoMap.value=g.aoMap,p.aoMapIntensity.value=g.aoMapIntensity,e(g.aoMap,p.aoMapTransform))}function a(p,g){p.diffuse.value.copy(g.color),p.opacity.value=g.opacity,g.map&&(p.map.value=g.map,e(g.map,p.mapTransform))}function o(p,g){p.dashSize.value=g.dashSize,p.totalSize.value=g.dashSize+g.gapSize,p.scale.value=g.scale}function l(p,g,S,b){p.diffuse.value.copy(g.color),p.opacity.value=g.opacity,p.size.value=g.size*S,p.scale.value=b*.5,g.map&&(p.map.value=g.map,e(g.map,p.uvTransform)),g.alphaMap&&(p.alphaMap.value=g.alphaMap,e(g.alphaMap,p.alphaMapTransform)),g.alphaTest>0&&(p.alphaTest.value=g.alphaTest)}function c(p,g){p.diffuse.value.copy(g.color),p.opacity.value=g.opacity,p.rotation.value=g.rotation,g.map&&(p.map.value=g.map,e(g.map,p.mapTransform)),g.alphaMap&&(p.alphaMap.value=g.alphaMap,e(g.alphaMap,p.alphaMapTransform)),g.alphaTest>0&&(p.alphaTest.value=g.alphaTest)}function h(p,g){p.specular.value.copy(g.specular),p.shininess.value=Math.max(g.shininess,1e-4)}function d(p,g){g.gradientMap&&(p.gradientMap.value=g.gradientMap)}function u(p,g){p.metalness.value=g.metalness,g.metalnessMap&&(p.metalnessMap.value=g.metalnessMap,e(g.metalnessMap,p.metalnessMapTransform)),p.roughness.value=g.roughness,g.roughnessMap&&(p.roughnessMap.value=g.roughnessMap,e(g.roughnessMap,p.roughnessMapTransform)),g.envMap&&(p.envMapIntensity.value=g.envMapIntensity)}function f(p,g,S){p.ior.value=g.ior,g.sheen>0&&(p.sheenColor.value.copy(g.sheenColor).multiplyScalar(g.sheen),p.sheenRoughness.value=g.sheenRoughness,g.sheenColorMap&&(p.sheenColorMap.value=g.sheenColorMap,e(g.sheenColorMap,p.sheenColorMapTransform)),g.sheenRoughnessMap&&(p.sheenRoughnessMap.value=g.sheenRoughnessMap,e(g.sheenRoughnessMap,p.sheenRoughnessMapTransform))),g.clearcoat>0&&(p.clearcoat.value=g.clearcoat,p.clearcoatRoughness.value=g.clearcoatRoughness,g.clearcoatMap&&(p.clearcoatMap.value=g.clearcoatMap,e(g.clearcoatMap,p.clearcoatMapTransform)),g.clearcoatRoughnessMap&&(p.clearcoatRoughnessMap.value=g.clearcoatRoughnessMap,e(g.clearcoatRoughnessMap,p.clearcoatRoughnessMapTransform)),g.clearcoatNormalMap&&(p.clearcoatNormalMap.value=g.clearcoatNormalMap,e(g.clearcoatNormalMap,p.clearcoatNormalMapTransform),p.clearcoatNormalScale.value.copy(g.clearcoatNormalScale),g.side===rn&&p.clearcoatNormalScale.value.negate())),g.dispersion>0&&(p.dispersion.value=g.dispersion),g.iridescence>0&&(p.iridescence.value=g.iridescence,p.iridescenceIOR.value=g.iridescenceIOR,p.iridescenceThicknessMinimum.value=g.iridescenceThicknessRange[0],p.iridescenceThicknessMaximum.value=g.iridescenceThicknessRange[1],g.iridescenceMap&&(p.iridescenceMap.value=g.iridescenceMap,e(g.iridescenceMap,p.iridescenceMapTransform)),g.iridescenceThicknessMap&&(p.iridescenceThicknessMap.value=g.iridescenceThicknessMap,e(g.iridescenceThicknessMap,p.iridescenceThicknessMapTransform))),g.transmission>0&&(p.transmission.value=g.transmission,p.transmissionSamplerMap.value=S.texture,p.transmissionSamplerSize.value.set(S.width,S.height),g.transmissionMap&&(p.transmissionMap.value=g.transmissionMap,e(g.transmissionMap,p.transmissionMapTransform)),p.thickness.value=g.thickness,g.thicknessMap&&(p.thicknessMap.value=g.thicknessMap,e(g.thicknessMap,p.thicknessMapTransform)),p.attenuationDistance.value=g.attenuationDistance,p.attenuationColor.value.copy(g.attenuationColor)),g.anisotropy>0&&(p.anisotropyVector.value.set(g.anisotropy*Math.cos(g.anisotropyRotation),g.anisotropy*Math.sin(g.anisotropyRotation)),g.anisotropyMap&&(p.anisotropyMap.value=g.anisotropyMap,e(g.anisotropyMap,p.anisotropyMapTransform))),p.specularIntensity.value=g.specularIntensity,p.specularColor.value.copy(g.specularColor),g.specularColorMap&&(p.specularColorMap.value=g.specularColorMap,e(g.specularColorMap,p.specularColorMapTransform)),g.specularIntensityMap&&(p.specularIntensityMap.value=g.specularIntensityMap,e(g.specularIntensityMap,p.specularIntensityMapTransform))}function m(p,g){g.matcap&&(p.matcap.value=g.matcap)}function y(p,g){let S=t.get(g).light;p.referencePosition.value.setFromMatrixPosition(S.matrixWorld),p.nearDistance.value=S.shadow.camera.near,p.farDistance.value=S.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function l_(i,t,e,n){let s={},r={},a=[],o=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function l(v,w){let T=w.program;n.uniformBlockBinding(v,T)}function c(v,w){let T=s[v.id];T===void 0&&(p(v),T=h(v),s[v.id]=T,v.addEventListener("dispose",S));let R=w.program;n.updateUBOMapping(v,R);let _=t.render.frame;r[v.id]!==_&&(u(v),r[v.id]=_)}function h(v){let w=d();v.__bindingPointIndex=w;let T=i.createBuffer(),R=v.__size,_=v.usage;return i.bindBuffer(i.UNIFORM_BUFFER,T),i.bufferData(i.UNIFORM_BUFFER,R,_),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,w,T),T}function d(){for(let v=0;v<o;v++)if(a.indexOf(v)===-1)return a.push(v),v;return Ht("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function u(v){let w=s[v.id],T=v.uniforms,R=v.__cache;i.bindBuffer(i.UNIFORM_BUFFER,w);for(let _=0,E=T.length;_<E;_++){let P=T[_];if(Array.isArray(P))for(let C=0,D=P.length;C<D;C++)f(P[C],_,C,R);else f(P,_,0,R)}i.bindBuffer(i.UNIFORM_BUFFER,null)}function f(v,w,T,R){if(y(v,w,T,R)===!0){let _=v.__offset,E=v.value;if(Array.isArray(E)){let P=0;for(let C=0;C<E.length;C++){let D=E[C],W=g(D);m(D,v.__data,P),typeof D!="number"&&typeof D!="boolean"&&!D.isMatrix3&&!ArrayBuffer.isView(D)&&(P+=W.storage/Float32Array.BYTES_PER_ELEMENT)}}else m(E,v.__data,0);i.bufferSubData(i.UNIFORM_BUFFER,_,v.__data)}}function m(v,w,T){typeof v=="number"||typeof v=="boolean"?w[0]=v:v.isMatrix3?(w[0]=v.elements[0],w[1]=v.elements[1],w[2]=v.elements[2],w[3]=0,w[4]=v.elements[3],w[5]=v.elements[4],w[6]=v.elements[5],w[7]=0,w[8]=v.elements[6],w[9]=v.elements[7],w[10]=v.elements[8],w[11]=0):ArrayBuffer.isView(v)?w.set(new v.constructor(v.buffer,v.byteOffset,w.length)):v.toArray(w,T)}function y(v,w,T,R){let _=v.value,E=w+"_"+T;if(R[E]===void 0)return typeof _=="number"||typeof _=="boolean"?R[E]=_:ArrayBuffer.isView(_)?R[E]=_.slice():R[E]=_.clone(),!0;{let P=R[E];if(typeof _=="number"||typeof _=="boolean"){if(P!==_)return R[E]=_,!0}else{if(ArrayBuffer.isView(_))return!0;if(P.equals(_)===!1)return P.copy(_),!0}}return!1}function p(v){let w=v.uniforms,T=0,R=16;for(let E=0,P=w.length;E<P;E++){let C=Array.isArray(w[E])?w[E]:[w[E]];for(let D=0,W=C.length;D<W;D++){let X=C[D],O=Array.isArray(X.value)?X.value:[X.value];for(let H=0,V=O.length;H<V;H++){let K=O[H],et=g(K),ot=T%R,ct=ot%et.boundary,it=ot+ct;T+=ct,it!==0&&R-it<et.storage&&(T+=R-it),X.__data=new Float32Array(et.storage/Float32Array.BYTES_PER_ELEMENT),X.__offset=T,T+=et.storage}}}let _=T%R;return _>0&&(T+=R-_),v.__size=T,v.__cache={},this}function g(v){let w={boundary:0,storage:0};return typeof v=="number"||typeof v=="boolean"?(w.boundary=4,w.storage=4):v.isVector2?(w.boundary=8,w.storage=8):v.isVector3||v.isColor?(w.boundary=16,w.storage=12):v.isVector4?(w.boundary=16,w.storage=16):v.isMatrix3?(w.boundary=48,w.storage=48):v.isMatrix4?(w.boundary=64,w.storage=64):v.isTexture?Gt("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(v)?(w.boundary=16,w.storage=v.byteLength):Gt("WebGLRenderer: Unsupported uniform value type.",v),w}function S(v){let w=v.target;w.removeEventListener("dispose",S);let T=a.indexOf(w.__bindingPointIndex);a.splice(T,1),i.deleteBuffer(s[w.id]),delete s[w.id],delete r[w.id]}function b(){for(let v in s)i.deleteBuffer(s[v]);a=[],s={},r={}}return{bind:l,update:c,dispose:b}}var c_=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),Gn=null;function h_(){return Gn===null&&(Gn=new va(c_,16,16,Ai,Hn),Gn.name="DFG_LUT",Gn.minFilter=Xe,Gn.magFilter=Xe,Gn.wrapS=Fn,Gn.wrapT=Fn,Gn.generateMipmaps=!1,Gn.needsUpdate=!0),Gn}var Uo=class{constructor(t={}){let{canvas:e=eu(),context:n=null,depth:s=!0,stencil:r=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:d=!1,reversedDepthBuffer:u=!1,outputBufferType:f=on}=t;this.isWebGLRenderer=!0;let m;if(n!==null){if(typeof WebGLRenderingContext!="undefined"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");m=n.getContextAttributes().alpha}else m=a;let y=f,p=new Set([$a,Ja,Ka]),g=new Set([on,Pn,ws,As,Ya,Za]),S=new Uint32Array(4),b=new Int32Array(4),v=new I,w=null,T=null,R=[],_=[],E=null;this.domElement=e,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=Cn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let P=this,C=!1,D=null,W=null,X=null,O=null;this._outputColorSpace=Se;let H=0,V=0,K=null,et=-1,ot=null,ct=new Te,it=new Te,zt=null,$t=new Yt(0),Zt=0,Z=e.width,at=e.height,tt=1,pt=null,Ft=null,Pt=new Te(0,0,Z,at),ne=new Te(0,0,Z,at),kt=!1,j=new xs,rt=!1,st=!1,mt=new ve,ut=new I,Ot=new Te,Rt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},Vt=!1;function Xt(){return K===null?tt:1}let L=n;function ue(M,U){return e.getContext(M,U)}try{let M={alpha:!0,depth:s,stencil:r,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:d};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${"185"}`),e.addEventListener("webglcontextlost",Ae,!1),e.addEventListener("webglcontextrestored",_e,!1),e.addEventListener("webglcontextcreationerror",Ln,!1),L===null){let U="webgl2";if(L=ue(U,M),L===null)throw ue(U)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}}catch(M){throw Ht("WebGLRenderer: "+M.message),M}let te,A,x,F,k,q,lt,dt,Y,Q,gt,Dt,vt,_t,Bt,Wt,Kt,N,ft,$,xt,bt,nt;function Lt(){te=new _0(L),te.init(),xt=new i_(L,te),A=new c0(L,te,t,xt),x=new e_(L,te),A.reversedDepthBuffer&&u&&x.buffers.depth.setReversed(!0),W=L.createFramebuffer(),X=L.createFramebuffer(),O=L.createFramebuffer(),F=new y0(L),k=new Vg,q=new n_(L,te,x,k,A,xt,F),lt=new g0(P),dt=new Tf(L),bt=new o0(L,dt),Y=new x0(L,dt,F,bt),Q=new S0(L,Y,dt,bt,F),N=new M0(L,A,q),Bt=new h0(k),gt=new kg(P,lt,te,A,bt,Bt),Dt=new o_(P,k),vt=new Gg,_t=new Kg(te),Kt=new a0(P,lt,x,Q,m,l),Wt=new t_(P,Q,A),nt=new l_(L,F,A,x),ft=new l0(L,te,F),$=new v0(L,te,F),F.programs=gt.programs,P.capabilities=A,P.extensions=te,P.properties=k,P.renderLists=vt,P.shadowMap=Wt,P.state=x,P.info=F}Lt(),y!==on&&(E=new T0(y,e.width,e.height,o,s,r));let Ct=new Pc(P,L);this.xr=Ct,this.getContext=function(){return L},this.getContextAttributes=function(){return L.getContextAttributes()},this.forceContextLoss=function(){let M=te.get("WEBGL_lose_context");M&&M.loseContext()},this.forceContextRestore=function(){let M=te.get("WEBGL_lose_context");M&&M.restoreContext()},this.getPixelRatio=function(){return tt},this.setPixelRatio=function(M){M!==void 0&&(tt=M,this.setSize(Z,at,!1))},this.getSize=function(M){return M.set(Z,at)},this.setSize=function(M,U,G=!0){if(Ct.isPresenting){Gt("WebGLRenderer: Can't change size while VR device is presenting.");return}Z=M,at=U,e.width=Math.floor(M*tt),e.height=Math.floor(U*tt),G===!0&&(e.style.width=M+"px",e.style.height=U+"px"),E!==null&&E.setSize(e.width,e.height),this.setViewport(0,0,M,U)},this.getDrawingBufferSize=function(M){return M.set(Z*tt,at*tt).floor()},this.setDrawingBufferSize=function(M,U,G){Z=M,at=U,tt=G,e.width=Math.floor(M*G),e.height=Math.floor(U*G),this.setViewport(0,0,M,U)},this.setEffects=function(M){if(y===on){Ht("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(M){for(let U=0;U<M.length;U++)if(M[U].isOutputPass===!0){Gt("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}E.setEffects(M||[])},this.getCurrentViewport=function(M){return M.copy(ct)},this.getViewport=function(M){return M.copy(Pt)},this.setViewport=function(M,U,G,B){M.isVector4?Pt.set(M.x,M.y,M.z,M.w):Pt.set(M,U,G,B),x.viewport(ct.copy(Pt).multiplyScalar(tt).round())},this.getScissor=function(M){return M.copy(ne)},this.setScissor=function(M,U,G,B){M.isVector4?ne.set(M.x,M.y,M.z,M.w):ne.set(M,U,G,B),x.scissor(it.copy(ne).multiplyScalar(tt).round())},this.getScissorTest=function(){return kt},this.setScissorTest=function(M){x.setScissorTest(kt=M)},this.setOpaqueSort=function(M){pt=M},this.setTransparentSort=function(M){Ft=M},this.getClearColor=function(M){return M.copy(Kt.getClearColor())},this.setClearColor=function(){Kt.setClearColor(...arguments)},this.getClearAlpha=function(){return Kt.getClearAlpha()},this.setClearAlpha=function(){Kt.setClearAlpha(...arguments)},this.clear=function(M=!0,U=!0,G=!0){let B=0;if(M){let z=!1;if(K!==null){let St=K.texture.format;z=p.has(St)}if(z){let St=K.texture.type,At=g.has(St),Mt=Kt.getClearColor(),It=Kt.getClearAlpha(),Nt=Mt.r,Jt=Mt.g,ee=Mt.b;At?(S[0]=Nt,S[1]=Jt,S[2]=ee,S[3]=It,L.clearBufferuiv(L.COLOR,0,S)):(b[0]=Nt,b[1]=Jt,b[2]=ee,b[3]=It,L.clearBufferiv(L.COLOR,0,b))}else B|=L.COLOR_BUFFER_BIT}U&&(B|=L.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),G&&(B|=L.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),B!==0&&L.clear(B)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(M){M.setRenderer(this),D=M},this.dispose=function(){e.removeEventListener("webglcontextlost",Ae,!1),e.removeEventListener("webglcontextrestored",_e,!1),e.removeEventListener("webglcontextcreationerror",Ln,!1),Kt.dispose(),vt.dispose(),_t.dispose(),k.dispose(),lt.dispose(),Q.dispose(),bt.dispose(),nt.dispose(),gt.dispose(),Ct.dispose(),Ct.removeEventListener("sessionstart",zc),Ct.removeEventListener("sessionend",kc),Ii.stop()};function Ae(M){M.preventDefault(),rc("WebGLRenderer: Context Lost."),C=!0}function _e(){rc("WebGLRenderer: Context Restored."),C=!1;let M=F.autoReset,U=Wt.enabled,G=Wt.autoUpdate,B=Wt.needsUpdate,z=Wt.type;Lt(),F.autoReset=M,Wt.enabled=U,Wt.autoUpdate=G,Wt.needsUpdate=B,Wt.type=z}function Ln(M){Ht("WebGLRenderer: A WebGL context could not be created. Reason: ",M.statusMessage)}function Dn(M){let U=M.target;U.removeEventListener("dispose",Dn),hd(U)}function hd(M){ud(M),k.remove(M)}function ud(M){let U=k.get(M).programs;U!==void 0&&(U.forEach(function(G){gt.releaseProgram(G)}),M.isShaderMaterial&&gt.releaseShaderCache(M))}this.renderBufferDirect=function(M,U,G,B,z,St){U===null&&(U=Rt);let At=z.isMesh&&z.matrixWorld.determinantAffine()<0,Mt=pd(M,U,G,B,z);x.setMaterial(B,At);let It=G.index,Nt=1;if(B.wireframe===!0){if(It=Y.getWireframeAttribute(G),It===void 0)return;Nt=2}let Jt=G.drawRange,ee=G.attributes.position,Ut=Jt.start*Nt,fe=(Jt.start+Jt.count)*Nt;St!==null&&(Ut=Math.max(Ut,St.start*Nt),fe=Math.min(fe,(St.start+St.count)*Nt)),It!==null?(Ut=Math.max(Ut,0),fe=Math.min(fe,It.count)):ee!=null&&(Ut=Math.max(Ut,0),fe=Math.min(fe,ee.count));let Ce=fe-Ut;if(Ce<0||Ce===1/0)return;bt.setup(z,B,Mt,G,It);let Re,me=ft;if(It!==null&&(Re=dt.get(It),me=$,me.setIndex(Re)),z.isMesh)B.wireframe===!0?(x.setLineWidth(B.wireframeLinewidth*Xt()),me.setMode(L.LINES)):me.setMode(L.TRIANGLES);else if(z.isLine){let Ze=B.linewidth;Ze===void 0&&(Ze=1),x.setLineWidth(Ze*Xt()),z.isLineSegments?me.setMode(L.LINES):z.isLineLoop?me.setMode(L.LINE_LOOP):me.setMode(L.LINE_STRIP)}else z.isPoints?me.setMode(L.POINTS):z.isSprite&&me.setMode(L.TRIANGLES);if(z.isBatchedMesh)if(te.get("WEBGL_multi_draw"))me.renderMultiDraw(z._multiDrawStarts,z._multiDrawCounts,z._multiDrawCount);else{let Ze=z._multiDrawStarts,Et=z._multiDrawCounts,hn=z._multiDrawCount,oe=It?dt.get(It).bytesPerElement:1,_n=k.get(B).currentProgram.getUniforms();for(let Nn=0;Nn<hn;Nn++)_n.setValue(L,"_gl_DrawID",Nn),me.render(Ze[Nn]/oe,Et[Nn])}else if(z.isInstancedMesh)me.renderInstances(Ut,Ce,z.count);else if(G.isInstancedBufferGeometry){let Ze=G._maxInstanceCount!==void 0?G._maxInstanceCount:1/0,Et=Math.min(G.instanceCount,Ze);me.renderInstances(Ut,Ce,Et)}else me.render(Ut,Ce)};function Bc(M,U,G){M.transparent===!0&&M.side===qe&&M.forceSinglePass===!1?(M.side=rn,M.needsUpdate=!0,Dr(M,U,G),M.side=Qn,M.needsUpdate=!0,Dr(M,U,G),M.side=qe):Dr(M,U,G)}this.compile=function(M,U,G=null){G===null&&(G=M),T=_t.get(G),T.init(U),_.push(T),G.traverseVisible(function(z){z.isLight&&z.layers.test(U.layers)&&(T.pushLight(z),z.castShadow&&T.pushShadow(z))}),M!==G&&M.traverseVisible(function(z){z.isLight&&z.layers.test(U.layers)&&(T.pushLight(z),z.castShadow&&T.pushShadow(z))}),T.setupLights();let B=new Set;return M.traverse(function(z){if(!(z.isMesh||z.isPoints||z.isLine||z.isSprite))return;let St=z.material;if(St)if(Array.isArray(St))for(let At=0;At<St.length;At++){let Mt=St[At];Bc(Mt,G,z),B.add(Mt)}else Bc(St,G,z),B.add(St)}),T=_.pop(),B},this.compileAsync=function(M,U,G=null){let B=this.compile(M,U,G);return new Promise(z=>{function St(){if(B.forEach(function(At){k.get(At).currentProgram.isReady()&&B.delete(At)}),B.size===0){z(M);return}setTimeout(St,10)}te.get("KHR_parallel_shader_compile")!==null?St():setTimeout(St,10)})};let Yo=null;function dd(M){Yo&&Yo(M)}function zc(){Ii.stop()}function kc(){Ii.start()}let Ii=new Nu;Ii.setAnimationLoop(dd),typeof self!="undefined"&&Ii.setContext(self),this.setAnimationLoop=function(M){Yo=M,Ct.setAnimationLoop(M),M===null?Ii.stop():Ii.start()},Ct.addEventListener("sessionstart",zc),Ct.addEventListener("sessionend",kc),this.render=function(M,U){if(U!==void 0&&U.isCamera!==!0){Ht("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(C===!0)return;D!==null&&D.renderStart(M,U);let G=Ct.enabled===!0&&Ct.isPresenting===!0,B=E!==null&&(K===null||G)&&E.begin(P,K);if(M.matrixWorldAutoUpdate===!0&&M.updateMatrixWorld(),U.parent===null&&U.matrixWorldAutoUpdate===!0&&U.updateMatrixWorld(),Ct.enabled===!0&&Ct.isPresenting===!0&&(E===null||E.isCompositing()===!1)&&(Ct.cameraAutoUpdate===!0&&Ct.updateCamera(U),U=Ct.getCamera()),M.isScene===!0&&M.onBeforeRender(P,M,U,K),T=_t.get(M,_.length),T.init(U),T.state.textureUnits=q.getTextureUnits(),_.push(T),mt.multiplyMatrices(U.projectionMatrix,U.matrixWorldInverse),j.setFromProjectionMatrix(mt,wn,U.reversedDepth),st=this.localClippingEnabled,rt=Bt.init(this.clippingPlanes,st),w=vt.get(M,R.length),w.init(),R.push(w),Ct.enabled===!0&&Ct.isPresenting===!0){let At=P.xr.getDepthSensingMesh();At!==null&&Zo(At,U,-1/0,P.sortObjects)}Zo(M,U,0,P.sortObjects),w.finish(),P.sortObjects===!0&&w.sort(pt,Ft,U.reversedDepth),Vt=Ct.enabled===!1||Ct.isPresenting===!1||Ct.hasDepthSensing()===!1,Vt&&Kt.addToRenderList(w,M),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),rt===!0&&Bt.beginShadows();let z=T.state.shadowsArray;if(Wt.render(z,M,U),rt===!0&&Bt.endShadows(),(B&&E.hasRenderPass())===!1){let At=w.opaque,Mt=w.transmissive;if(T.setupLights(),U.isArrayCamera){let It=U.cameras;if(Mt.length>0)for(let Nt=0,Jt=It.length;Nt<Jt;Nt++){let ee=It[Nt];Hc(At,Mt,M,ee)}Vt&&Kt.render(M);for(let Nt=0,Jt=It.length;Nt<Jt;Nt++){let ee=It[Nt];Vc(w,M,ee,ee.viewport)}}else Mt.length>0&&Hc(At,Mt,M,U),Vt&&Kt.render(M),Vc(w,M,U)}K!==null&&V===0&&(q.updateMultisampleRenderTarget(K),q.updateRenderTargetMipmap(K)),B&&E.end(P),M.isScene===!0&&M.onAfterRender(P,M,U),bt.resetDefaultState(),et=-1,ot=null,_.pop(),_.length>0?(T=_[_.length-1],q.setTextureUnits(T.state.textureUnits),rt===!0&&Bt.setGlobalState(P.clippingPlanes,T.state.camera)):T=null,R.pop(),R.length>0?w=R[R.length-1]:w=null,D!==null&&D.renderEnd()};function Zo(M,U,G,B){if(M.visible===!1)return;if(M.layers.test(U.layers)){if(M.isGroup)G=M.renderOrder;else if(M.isLOD)M.autoUpdate===!0&&M.update(U);else if(M.isLightProbeGrid)T.pushLightProbeGrid(M);else if(M.isLight)T.pushLight(M),M.castShadow&&T.pushShadow(M);else if(M.isSprite){if(!M.frustumCulled||j.intersectsSprite(M)){B&&Ot.setFromMatrixPosition(M.matrixWorld).applyMatrix4(mt);let At=Q.update(M),Mt=M.material;Mt.visible&&w.push(M,At,Mt,G,Ot.z,null)}}else if((M.isMesh||M.isLine||M.isPoints)&&(!M.frustumCulled||j.intersectsObject(M))){let At=Q.update(M),Mt=M.material;if(B&&(M.boundingSphere!==void 0?(M.boundingSphere===null&&M.computeBoundingSphere(),Ot.copy(M.boundingSphere.center)):(At.boundingSphere===null&&At.computeBoundingSphere(),Ot.copy(At.boundingSphere.center)),Ot.applyMatrix4(M.matrixWorld).applyMatrix4(mt)),Array.isArray(Mt)){let It=At.groups;for(let Nt=0,Jt=It.length;Nt<Jt;Nt++){let ee=It[Nt],Ut=Mt[ee.materialIndex];Ut&&Ut.visible&&w.push(M,At,Ut,G,Ot.z,ee)}}else Mt.visible&&w.push(M,At,Mt,G,Ot.z,null)}}let St=M.children;for(let At=0,Mt=St.length;At<Mt;At++)Zo(St[At],U,G,B)}function Vc(M,U,G,B){let{opaque:z,transmissive:St,transparent:At}=M;T.setupLightsView(G),rt===!0&&Bt.setGlobalState(P.clippingPlanes,G),B&&x.viewport(ct.copy(B)),z.length>0&&Lr(z,U,G),St.length>0&&Lr(St,U,G),At.length>0&&Lr(At,U,G),x.buffers.depth.setTest(!0),x.buffers.depth.setMask(!0),x.buffers.color.setMask(!0),x.setPolygonOffset(!1)}function Hc(M,U,G,B){if((G.isScene===!0?G.overrideMaterial:null)!==null)return;if(T.state.transmissionRenderTarget[B.id]===void 0){let Ut=te.has("EXT_color_buffer_half_float")||te.has("EXT_color_buffer_float");T.state.transmissionRenderTarget[B.id]=new fn(1,1,{generateMipmaps:!0,type:Ut?Hn:on,minFilter:Ei,samples:Math.max(4,A.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:se.workingColorSpace})}let St=T.state.transmissionRenderTarget[B.id],At=B.viewport||ct;St.setSize(At.z*P.transmissionResolutionScale,At.w*P.transmissionResolutionScale);let Mt=P.getRenderTarget(),It=P.getActiveCubeFace(),Nt=P.getActiveMipmapLevel();P.setRenderTarget(St),P.getClearColor($t),Zt=P.getClearAlpha(),Zt<1&&P.setClearColor(16777215,.5),P.clear(),Vt&&Kt.render(G);let Jt=P.toneMapping;P.toneMapping=Cn;let ee=B.viewport;if(B.viewport!==void 0&&(B.viewport=void 0),T.setupLightsView(B),rt===!0&&Bt.setGlobalState(P.clippingPlanes,B),Lr(M,G,B),q.updateMultisampleRenderTarget(St),q.updateRenderTargetMipmap(St),te.has("WEBGL_multisampled_render_to_texture")===!1){let Ut=!1;for(let fe=0,Ce=U.length;fe<Ce;fe++){let Re=U[fe],{object:me,geometry:Ze,material:Et,group:hn}=Re;if(Et.side===qe&&me.layers.test(B.layers)){let oe=Et.side;Et.side=rn,Et.needsUpdate=!0,Gc(me,G,B,Ze,Et,hn),Et.side=oe,Et.needsUpdate=!0,Ut=!0}}Ut===!0&&(q.updateMultisampleRenderTarget(St),q.updateRenderTargetMipmap(St))}P.setRenderTarget(Mt,It,Nt),P.setClearColor($t,Zt),ee!==void 0&&(B.viewport=ee),P.toneMapping=Jt}function Lr(M,U,G){let B=U.isScene===!0?U.overrideMaterial:null;for(let z=0,St=M.length;z<St;z++){let At=M[z],{object:Mt,geometry:It,group:Nt}=At,Jt=At.material;Jt.allowOverride===!0&&B!==null&&(Jt=B),Mt.layers.test(G.layers)&&Gc(Mt,U,G,It,Jt,Nt)}}function Gc(M,U,G,B,z,St){M.onBeforeRender(P,U,G,B,z,St),M.modelViewMatrix.multiplyMatrices(G.matrixWorldInverse,M.matrixWorld),M.normalMatrix.getNormalMatrix(M.modelViewMatrix),z.onBeforeRender(P,U,G,B,M,St),z.transparent===!0&&z.side===qe&&z.forceSinglePass===!1?(z.side=rn,z.needsUpdate=!0,P.renderBufferDirect(G,U,B,z,M,St),z.side=Qn,z.needsUpdate=!0,P.renderBufferDirect(G,U,B,z,M,St),z.side=qe):P.renderBufferDirect(G,U,B,z,M,St),M.onAfterRender(P,U,G,B,z,St)}function Dr(M,U,G){U.isScene!==!0&&(U=Rt);let B=k.get(M),z=T.state.lights,St=T.state.shadowsArray,At=z.state.version,Mt=gt.getParameters(M,z.state,St,U,G,T.state.lightProbeGridArray),It=gt.getProgramCacheKey(Mt),Nt=B.programs;B.environment=M.isMeshStandardMaterial||M.isMeshLambertMaterial||M.isMeshPhongMaterial?U.environment:null,B.fog=U.fog;let Jt=M.isMeshStandardMaterial||M.isMeshLambertMaterial&&!M.envMap||M.isMeshPhongMaterial&&!M.envMap;B.envMap=lt.get(M.envMap||B.environment,Jt),B.envMapRotation=B.environment!==null&&M.envMap===null?U.environmentRotation:M.envMapRotation,Nt===void 0&&(M.addEventListener("dispose",Dn),Nt=new Map,B.programs=Nt);let ee=Nt.get(It);if(ee!==void 0){if(B.currentProgram===ee&&B.lightsStateVersion===At)return Xc(M,Mt),ee}else Mt.uniforms=gt.getUniforms(M),D!==null&&M.isNodeMaterial&&D.build(M,G,Mt),M.onBeforeCompile(Mt,P),ee=gt.acquireProgram(Mt,It),Nt.set(It,ee),B.uniforms=Mt.uniforms;let Ut=B.uniforms;return(!M.isShaderMaterial&&!M.isRawShaderMaterial||M.clipping===!0)&&(Ut.clippingPlanes=Bt.uniform),Xc(M,Mt),B.needsLights=gd(M),B.lightsStateVersion=At,B.needsLights&&(Ut.ambientLightColor.value=z.state.ambient,Ut.lightProbe.value=z.state.probe,Ut.directionalLights.value=z.state.directional,Ut.directionalLightShadows.value=z.state.directionalShadow,Ut.spotLights.value=z.state.spot,Ut.spotLightShadows.value=z.state.spotShadow,Ut.rectAreaLights.value=z.state.rectArea,Ut.ltc_1.value=z.state.rectAreaLTC1,Ut.ltc_2.value=z.state.rectAreaLTC2,Ut.pointLights.value=z.state.point,Ut.pointLightShadows.value=z.state.pointShadow,Ut.hemisphereLights.value=z.state.hemi,Ut.directionalShadowMatrix.value=z.state.directionalShadowMatrix,Ut.spotLightMatrix.value=z.state.spotLightMatrix,Ut.spotLightMap.value=z.state.spotLightMap,Ut.pointShadowMatrix.value=z.state.pointShadowMatrix),B.lightProbeGrid=T.state.lightProbeGridArray.length>0,B.currentProgram=ee,B.uniformsList=null,ee}function Wc(M){if(M.uniformsList===null){let U=M.currentProgram.getUniforms();M.uniformsList=Ps.seqWithValue(U.seq,M.uniforms)}return M.uniformsList}function Xc(M,U){let G=k.get(M);G.outputColorSpace=U.outputColorSpace,G.batching=U.batching,G.batchingColor=U.batchingColor,G.instancing=U.instancing,G.instancingColor=U.instancingColor,G.instancingMorph=U.instancingMorph,G.skinning=U.skinning,G.morphTargets=U.morphTargets,G.morphNormals=U.morphNormals,G.morphColors=U.morphColors,G.morphTargetsCount=U.morphTargetsCount,G.numClippingPlanes=U.numClippingPlanes,G.numIntersection=U.numClipIntersection,G.vertexAlphas=U.vertexAlphas,G.vertexTangents=U.vertexTangents,G.toneMapping=U.toneMapping}function fd(M,U){if(M.length===0)return null;if(M.length===1)return M[0].texture!==null?M[0]:null;v.setFromMatrixPosition(U.matrixWorld);for(let G=0,B=M.length;G<B;G++){let z=M[G];if(z.texture!==null&&z.boundingBox.containsPoint(v))return z}return null}function pd(M,U,G,B,z){U.isScene!==!0&&(U=Rt),q.resetTextureUnits();let St=U.fog,At=B.isMeshStandardMaterial||B.isMeshLambertMaterial||B.isMeshPhongMaterial?U.environment:null,Mt=K===null?P.outputColorSpace:K.isXRRenderTarget===!0?K.texture.colorSpace:se.workingColorSpace,It=B.isMeshStandardMaterial||B.isMeshLambertMaterial&&!B.envMap||B.isMeshPhongMaterial&&!B.envMap,Nt=lt.get(B.envMap||At,It),Jt=B.vertexColors===!0&&!!G.attributes.color&&G.attributes.color.itemSize===4,ee=!!G.attributes.tangent&&(!!B.normalMap||B.anisotropy>0),Ut=!!G.morphAttributes.position,fe=!!G.morphAttributes.normal,Ce=!!G.morphAttributes.color,Re=Cn;B.toneMapped&&(K===null||K.isXRRenderTarget===!0)&&(Re=P.toneMapping);let me=G.morphAttributes.position||G.morphAttributes.normal||G.morphAttributes.color,Ze=me!==void 0?me.length:0,Et=k.get(B),hn=T.state.lights;if(rt===!0&&(st===!0||M!==ot)){let xe=M===ot&&B.id===et;Bt.setState(B,M,xe)}let oe=!1;B.version===Et.__version?(Et.needsLights&&Et.lightsStateVersion!==hn.state.version||Et.outputColorSpace!==Mt||z.isBatchedMesh&&Et.batching===!1||!z.isBatchedMesh&&Et.batching===!0||z.isBatchedMesh&&Et.batchingColor===!0&&z.colorTexture===null||z.isBatchedMesh&&Et.batchingColor===!1&&z.colorTexture!==null||z.isInstancedMesh&&Et.instancing===!1||!z.isInstancedMesh&&Et.instancing===!0||z.isSkinnedMesh&&Et.skinning===!1||!z.isSkinnedMesh&&Et.skinning===!0||z.isInstancedMesh&&Et.instancingColor===!0&&z.instanceColor===null||z.isInstancedMesh&&Et.instancingColor===!1&&z.instanceColor!==null||z.isInstancedMesh&&Et.instancingMorph===!0&&z.morphTexture===null||z.isInstancedMesh&&Et.instancingMorph===!1&&z.morphTexture!==null||Et.envMap!==Nt||B.fog===!0&&Et.fog!==St||Et.numClippingPlanes!==void 0&&(Et.numClippingPlanes!==Bt.numPlanes||Et.numIntersection!==Bt.numIntersection)||Et.vertexAlphas!==Jt||Et.vertexTangents!==ee||Et.morphTargets!==Ut||Et.morphNormals!==fe||Et.morphColors!==Ce||Et.toneMapping!==Re||Et.morphTargetsCount!==Ze||!!Et.lightProbeGrid!=T.state.lightProbeGridArray.length>0)&&(oe=!0):(oe=!0,Et.__version=B.version);let _n=Et.currentProgram;oe===!0&&(_n=Dr(B,U,z),D&&B.isNodeMaterial&&D.onUpdateProgram(B,_n,Et));let Nn=!1,li=!1,$i=!1,ge=_n.getUniforms(),Pe=Et.uniforms;if(x.useProgram(_n.program)&&(Nn=!0,li=!0,$i=!0),B.id!==et&&(et=B.id,li=!0),Et.needsLights){let xe=fd(T.state.lightProbeGridArray,z);Et.lightProbeGrid!==xe&&(Et.lightProbeGrid=xe,li=!0)}if(Nn||ot!==M){x.buffers.depth.getReversed()&&M.reversedDepth!==!0&&(M._reversedDepth=!0,M.updateProjectionMatrix()),ge.setValue(L,"projectionMatrix",M.projectionMatrix),ge.setValue(L,"viewMatrix",M.matrixWorldInverse);let hi=ge.map.cameraPosition;hi!==void 0&&hi.setValue(L,ut.setFromMatrixPosition(M.matrixWorld)),A.logarithmicDepthBuffer&&ge.setValue(L,"logDepthBufFC",2/(Math.log(M.far+1)/Math.LN2)),(B.isMeshPhongMaterial||B.isMeshToonMaterial||B.isMeshLambertMaterial||B.isMeshBasicMaterial||B.isMeshStandardMaterial||B.isShaderMaterial)&&ge.setValue(L,"isOrthographic",M.isOrthographicCamera===!0),ot!==M&&(ot=M,li=!0,$i=!0)}if(Et.needsLights&&(hn.state.directionalShadowMap.length>0&&ge.setValue(L,"directionalShadowMap",hn.state.directionalShadowMap,q),hn.state.spotShadowMap.length>0&&ge.setValue(L,"spotShadowMap",hn.state.spotShadowMap,q),hn.state.pointShadowMap.length>0&&ge.setValue(L,"pointShadowMap",hn.state.pointShadowMap,q)),z.isSkinnedMesh){ge.setOptional(L,z,"bindMatrix"),ge.setOptional(L,z,"bindMatrixInverse");let xe=z.skeleton;xe&&(xe.boneTexture===null&&xe.computeBoneTexture(),ge.setValue(L,"boneTexture",xe.boneTexture,q))}z.isBatchedMesh&&(ge.setOptional(L,z,"batchingTexture"),ge.setValue(L,"batchingTexture",z._matricesTexture,q),ge.setOptional(L,z,"batchingIdTexture"),ge.setValue(L,"batchingIdTexture",z._indirectTexture,q),ge.setOptional(L,z,"batchingColorTexture"),z._colorsTexture!==null&&ge.setValue(L,"batchingColorTexture",z._colorsTexture,q));let ci=G.morphAttributes;if((ci.position!==void 0||ci.normal!==void 0||ci.color!==void 0)&&N.update(z,G,_n),(li||Et.receiveShadow!==z.receiveShadow)&&(Et.receiveShadow=z.receiveShadow,ge.setValue(L,"receiveShadow",z.receiveShadow)),(B.isMeshStandardMaterial||B.isMeshLambertMaterial||B.isMeshPhongMaterial)&&B.envMap===null&&U.environment!==null&&(Pe.envMapIntensity.value=U.environmentIntensity),Pe.dfgLUT!==void 0&&(Pe.dfgLUT.value=h_()),li){if(ge.setValue(L,"toneMappingExposure",P.toneMappingExposure),Et.needsLights&&md(Pe,$i),St&&B.fog===!0&&Dt.refreshFogUniforms(Pe,St),Dt.refreshMaterialUniforms(Pe,B,tt,at,T.state.transmissionRenderTarget[M.id]),Et.needsLights&&Et.lightProbeGrid){let xe=Et.lightProbeGrid;Pe.probesSH.value=xe.texture,Pe.probesMin.value.copy(xe.boundingBox.min),Pe.probesMax.value.copy(xe.boundingBox.max),Pe.probesResolution.value.copy(xe.resolution)}Ps.upload(L,Wc(Et),Pe,q)}if(B.isShaderMaterial&&B.uniformsNeedUpdate===!0&&(Ps.upload(L,Wc(Et),Pe,q),B.uniformsNeedUpdate=!1),B.isSpriteMaterial&&ge.setValue(L,"center",z.center),ge.setValue(L,"modelViewMatrix",z.modelViewMatrix),ge.setValue(L,"normalMatrix",z.normalMatrix),ge.setValue(L,"modelMatrix",z.matrixWorld),B.uniformsGroups!==void 0){let xe=B.uniformsGroups;for(let hi=0,Qi=xe.length;hi<Qi;hi++){let qc=xe[hi];nt.update(qc,_n),nt.bind(qc,_n)}}return _n}function md(M,U){M.ambientLightColor.needsUpdate=U,M.lightProbe.needsUpdate=U,M.directionalLights.needsUpdate=U,M.directionalLightShadows.needsUpdate=U,M.pointLights.needsUpdate=U,M.pointLightShadows.needsUpdate=U,M.spotLights.needsUpdate=U,M.spotLightShadows.needsUpdate=U,M.rectAreaLights.needsUpdate=U,M.hemisphereLights.needsUpdate=U}function gd(M){return M.isMeshLambertMaterial||M.isMeshToonMaterial||M.isMeshPhongMaterial||M.isMeshStandardMaterial||M.isShadowMaterial||M.isShaderMaterial&&M.lights===!0}this.getActiveCubeFace=function(){return H},this.getActiveMipmapLevel=function(){return V},this.getRenderTarget=function(){return K},this.setRenderTargetTextures=function(M,U,G){let B=k.get(M);B.__autoAllocateDepthBuffer=M.resolveDepthBuffer===!1,B.__autoAllocateDepthBuffer===!1&&(B.__useRenderToTexture=!1),k.get(M.texture).__webglTexture=U,k.get(M.depthTexture).__webglTexture=B.__autoAllocateDepthBuffer?void 0:G,B.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(M,U){let G=k.get(M);G.__webglFramebuffer=U,G.__useDefaultFramebuffer=U===void 0},this.setRenderTarget=function(M,U=0,G=0){K=M,H=U,V=G;let B=null,z=!1,St=!1;if(M){let Mt=k.get(M);if(Mt.__useDefaultFramebuffer!==void 0){x.bindFramebuffer(L.FRAMEBUFFER,Mt.__webglFramebuffer),ct.copy(M.viewport),it.copy(M.scissor),zt=M.scissorTest,x.viewport(ct),x.scissor(it),x.setScissorTest(zt),et=-1;return}else if(Mt.__webglFramebuffer===void 0)q.setupRenderTarget(M);else if(Mt.__hasExternalTextures)q.rebindTextures(M,k.get(M.texture).__webglTexture,k.get(M.depthTexture).__webglTexture);else if(M.depthBuffer){let Jt=M.depthTexture;if(Mt.__boundDepthTexture!==Jt){if(Jt!==null&&k.has(Jt)&&(M.width!==Jt.image.width||M.height!==Jt.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");q.setupDepthRenderbuffer(M)}}let It=M.texture;(It.isData3DTexture||It.isDataArrayTexture||It.isCompressedArrayTexture)&&(St=!0);let Nt=k.get(M).__webglFramebuffer;M.isWebGLCubeRenderTarget?(Array.isArray(Nt[U])?B=Nt[U][G]:B=Nt[U],z=!0):M.samples>0&&q.useMultisampledRTT(M)===!1?B=k.get(M).__webglMultisampledFramebuffer:Array.isArray(Nt)?B=Nt[G]:B=Nt,ct.copy(M.viewport),it.copy(M.scissor),zt=M.scissorTest}else ct.copy(Pt).multiplyScalar(tt).floor(),it.copy(ne).multiplyScalar(tt).floor(),zt=kt;if(G!==0&&(B=W),x.bindFramebuffer(L.FRAMEBUFFER,B)&&x.drawBuffers(M,B),x.viewport(ct),x.scissor(it),x.setScissorTest(zt),z){let Mt=k.get(M.texture);L.framebufferTexture2D(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_CUBE_MAP_POSITIVE_X+U,Mt.__webglTexture,G)}else if(St){let Mt=U;for(let It=0;It<M.textures.length;It++){let Nt=k.get(M.textures[It]);L.framebufferTextureLayer(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0+It,Nt.__webglTexture,G,Mt)}}else if(M!==null&&G!==0){let Mt=k.get(M.texture);L.framebufferTexture2D(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,Mt.__webglTexture,G)}et=-1},this.readRenderTargetPixels=function(M,U,G,B,z,St,At,Mt=0){if(!(M&&M.isWebGLRenderTarget)){Ht("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let It=k.get(M).__webglFramebuffer;if(M.isWebGLCubeRenderTarget&&At!==void 0&&(It=It[At]),It){x.bindFramebuffer(L.FRAMEBUFFER,It);try{let Nt=M.textures[Mt],Jt=Nt.format,ee=Nt.type;if(M.textures.length>1&&L.readBuffer(L.COLOR_ATTACHMENT0+Mt),!A.textureFormatReadable(Jt)){Ht("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!A.textureTypeReadable(ee)){Ht("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}U>=0&&U<=M.width-B&&G>=0&&G<=M.height-z&&L.readPixels(U,G,B,z,xt.convert(Jt),xt.convert(ee),St)}finally{let Nt=K!==null?k.get(K).__webglFramebuffer:null;x.bindFramebuffer(L.FRAMEBUFFER,Nt)}}},this.readRenderTargetPixelsAsync=async function(M,U,G,B,z,St,At,Mt=0){if(!(M&&M.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let It=k.get(M).__webglFramebuffer;if(M.isWebGLCubeRenderTarget&&At!==void 0&&(It=It[At]),It)if(U>=0&&U<=M.width-B&&G>=0&&G<=M.height-z){x.bindFramebuffer(L.FRAMEBUFFER,It);let Nt=M.textures[Mt],Jt=Nt.format,ee=Nt.type;if(M.textures.length>1&&L.readBuffer(L.COLOR_ATTACHMENT0+Mt),!A.textureFormatReadable(Jt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!A.textureTypeReadable(ee))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let Ut=L.createBuffer();L.bindBuffer(L.PIXEL_PACK_BUFFER,Ut),L.bufferData(L.PIXEL_PACK_BUFFER,St.byteLength,L.STREAM_READ),L.readPixels(U,G,B,z,xt.convert(Jt),xt.convert(ee),0);let fe=K!==null?k.get(K).__webglFramebuffer:null;x.bindFramebuffer(L.FRAMEBUFFER,fe);let Ce=L.fenceSync(L.SYNC_GPU_COMMANDS_COMPLETE,0);return L.flush(),await iu(L,Ce,4),L.bindBuffer(L.PIXEL_PACK_BUFFER,Ut),L.getBufferSubData(L.PIXEL_PACK_BUFFER,0,St),L.deleteBuffer(Ut),L.deleteSync(Ce),St}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(M,U=null,G=0){let B=Math.pow(2,-G),z=Math.floor(M.image.width*B),St=Math.floor(M.image.height*B),At=U!==null?U.x:0,Mt=U!==null?U.y:0;q.setTexture2D(M,0),L.copyTexSubImage2D(L.TEXTURE_2D,G,0,0,At,Mt,z,St),x.unbindTexture()},this.copyTextureToTexture=function(M,U,G=null,B=null,z=0,St=0){let At,Mt,It,Nt,Jt,ee,Ut,fe,Ce,Re=M.isCompressedTexture?M.mipmaps[St]:M.image;if(G!==null)At=G.max.x-G.min.x,Mt=G.max.y-G.min.y,It=G.isBox3?G.max.z-G.min.z:1,Nt=G.min.x,Jt=G.min.y,ee=G.isBox3?G.min.z:0;else{let Pe=Math.pow(2,-z);At=Math.floor(Re.width*Pe),Mt=Math.floor(Re.height*Pe),M.isDataArrayTexture?It=Re.depth:M.isData3DTexture?It=Math.floor(Re.depth*Pe):It=1,Nt=0,Jt=0,ee=0}B!==null?(Ut=B.x,fe=B.y,Ce=B.z):(Ut=0,fe=0,Ce=0);let me=xt.convert(U.format),Ze=xt.convert(U.type),Et;U.isData3DTexture?(q.setTexture3D(U,0),Et=L.TEXTURE_3D):U.isDataArrayTexture||U.isCompressedArrayTexture?(q.setTexture2DArray(U,0),Et=L.TEXTURE_2D_ARRAY):(q.setTexture2D(U,0),Et=L.TEXTURE_2D),x.activeTexture(L.TEXTURE0),x.pixelStorei(L.UNPACK_FLIP_Y_WEBGL,U.flipY),x.pixelStorei(L.UNPACK_PREMULTIPLY_ALPHA_WEBGL,U.premultiplyAlpha),x.pixelStorei(L.UNPACK_ALIGNMENT,U.unpackAlignment);let hn=x.getParameter(L.UNPACK_ROW_LENGTH),oe=x.getParameter(L.UNPACK_IMAGE_HEIGHT),_n=x.getParameter(L.UNPACK_SKIP_PIXELS),Nn=x.getParameter(L.UNPACK_SKIP_ROWS),li=x.getParameter(L.UNPACK_SKIP_IMAGES);x.pixelStorei(L.UNPACK_ROW_LENGTH,Re.width),x.pixelStorei(L.UNPACK_IMAGE_HEIGHT,Re.height),x.pixelStorei(L.UNPACK_SKIP_PIXELS,Nt),x.pixelStorei(L.UNPACK_SKIP_ROWS,Jt),x.pixelStorei(L.UNPACK_SKIP_IMAGES,ee);let $i=M.isDataArrayTexture||M.isData3DTexture,ge=U.isDataArrayTexture||U.isData3DTexture;if(M.isDepthTexture){let Pe=k.get(M),ci=k.get(U),xe=k.get(Pe.__renderTarget),hi=k.get(ci.__renderTarget);x.bindFramebuffer(L.READ_FRAMEBUFFER,xe.__webglFramebuffer),x.bindFramebuffer(L.DRAW_FRAMEBUFFER,hi.__webglFramebuffer);for(let Qi=0;Qi<It;Qi++)$i&&(L.framebufferTextureLayer(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,k.get(M).__webglTexture,z,ee+Qi),L.framebufferTextureLayer(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,k.get(U).__webglTexture,St,Ce+Qi)),L.blitFramebuffer(Nt,Jt,At,Mt,Ut,fe,At,Mt,L.DEPTH_BUFFER_BIT,L.NEAREST);x.bindFramebuffer(L.READ_FRAMEBUFFER,null),x.bindFramebuffer(L.DRAW_FRAMEBUFFER,null)}else if(z!==0||M.isRenderTargetTexture||k.has(M)){let Pe=k.get(M),ci=k.get(U);x.bindFramebuffer(L.READ_FRAMEBUFFER,X),x.bindFramebuffer(L.DRAW_FRAMEBUFFER,O);for(let xe=0;xe<It;xe++)$i?L.framebufferTextureLayer(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,Pe.__webglTexture,z,ee+xe):L.framebufferTexture2D(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,Pe.__webglTexture,z),ge?L.framebufferTextureLayer(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,ci.__webglTexture,St,Ce+xe):L.framebufferTexture2D(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_2D,ci.__webglTexture,St),z!==0?L.blitFramebuffer(Nt,Jt,At,Mt,Ut,fe,At,Mt,L.COLOR_BUFFER_BIT,L.NEAREST):ge?L.copyTexSubImage3D(Et,St,Ut,fe,Ce+xe,Nt,Jt,At,Mt):L.copyTexSubImage2D(Et,St,Ut,fe,Nt,Jt,At,Mt);x.bindFramebuffer(L.READ_FRAMEBUFFER,null),x.bindFramebuffer(L.DRAW_FRAMEBUFFER,null)}else ge?M.isDataTexture||M.isData3DTexture?L.texSubImage3D(Et,St,Ut,fe,Ce,At,Mt,It,me,Ze,Re.data):U.isCompressedArrayTexture?L.compressedTexSubImage3D(Et,St,Ut,fe,Ce,At,Mt,It,me,Re.data):L.texSubImage3D(Et,St,Ut,fe,Ce,At,Mt,It,me,Ze,Re):M.isDataTexture?L.texSubImage2D(L.TEXTURE_2D,St,Ut,fe,At,Mt,me,Ze,Re.data):M.isCompressedTexture?L.compressedTexSubImage2D(L.TEXTURE_2D,St,Ut,fe,Re.width,Re.height,me,Re.data):L.texSubImage2D(L.TEXTURE_2D,St,Ut,fe,At,Mt,me,Ze,Re);x.pixelStorei(L.UNPACK_ROW_LENGTH,hn),x.pixelStorei(L.UNPACK_IMAGE_HEIGHT,oe),x.pixelStorei(L.UNPACK_SKIP_PIXELS,_n),x.pixelStorei(L.UNPACK_SKIP_ROWS,Nn),x.pixelStorei(L.UNPACK_SKIP_IMAGES,li),St===0&&U.generateMipmaps&&L.generateMipmap(Et),x.unbindTexture()},this.initRenderTarget=function(M){k.get(M).__webglFramebuffer===void 0&&q.setupRenderTarget(M)},this.initTexture=function(M){M.isCubeTexture?q.setTextureCube(M,0):M.isData3DTexture?q.setTexture3D(M,0):M.isDataArrayTexture||M.isCompressedArrayTexture?q.setTexture2DArray(M,0):q.setTexture2D(M,0),x.unbindTexture()},this.resetState=function(){H=0,V=0,K=null,x.reset(),bt.reset()},typeof __THREE_DEVTOOLS__!="undefined"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return wn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;let e=this.getContext();e.drawingBufferColorSpace=se._getDrawingBufferColorSpace(t),e.unpackColorSpace=se._getUnpackColorSpace()}};var He=new Map;function ln(i,t,e){let n=document.createElement("canvas");return n.width=i,n.height=t,e(n.getContext("2d"),i,t),n}function gn(i,{srgb:t=!1,repeat:e=[1,1],aniso:n=8}={}){let s=new yn(i);return s.wrapS=s.wrapT=ti,s.repeat.set(e[0],e[1]),s.anisotropy=n,t&&(s.colorSpace=Se),s.needsUpdate=!0,s}function Yi(i,t=2){let e=i.width,n=i.height,r=i.getContext("2d").getImageData(0,0,e,n).data,a=document.createElement("canvas");a.width=e,a.height=n;let o=a.getContext("2d"),l=o.createImageData(e,n),c=l.data,h=(d,u)=>{let f=(d+e)%e,m=(u+n)%n;return r[(m*e+f)*4]/255};for(let d=0;d<n;d++)for(let u=0;u<e;u++){let f=h(u-1,d-1),m=h(u,d-1),y=h(u+1,d-1),p=h(u-1,d),g=h(u+1,d),S=h(u-1,d+1),b=h(u,d+1),v=h(u+1,d+1),w=y+2*g+v-(f+2*p+S),T=S+2*b+v-(f+2*m+y),R=-w*t,_=-T*t,E=1,P=Math.hypot(R,_,E);R/=P,_/=P,E/=P;let C=(d*e+u)*4;c[C]=(R*.5+.5)*255,c[C+1]=(_*.5+.5)*255,c[C+2]=(E*.5+.5)*255,c[C+3]=255}return o.putImageData(l,0,0),a}function u_(i,t,e){let n=Bo(e),s=new Float32Array(t*t);for(let a=0;a<s.length;a++)s[a]=n();let r=a=>a*a*(3-2*a);return(a,o)=>{let l=a*t,c=o*t,h=Math.floor(l),d=Math.floor(c),u=r(l-h),f=r(c-d),m=(b,v)=>s[(v%t+t)%t*t+(b%t+t)%t],y=m(h,d),p=m(h+1,d),g=m(h,d+1),S=m(h+1,d+1);return(y*(1-u)+p*u)*(1-f)+(g*(1-u)+S*u)*f}}function Ye(i,t,e,n){let s=[],r=t,a=1,o=0;for(let l=0;l<e;l++)s.push({n:u_(i,Math.max(2,Math.round(r)),n+l*97),amp:a}),o+=a,r*=2,a*=.5;return(l,c)=>{let h=0;for(let d of s)h+=d.n(l,c)*d.amp;return h/o}}function Bo(i){let t=i>>>0;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function zo(){if(He.has("wood"))return He.get("wood");let i=1024,t=Ye(i,4,4,11),e=Ye(i,6,4,23),n=Ye(i,40,3,31),s=Ye(i,150,2,131),r=ln(i,i,(c,h,d)=>{let u=c.createImageData(h,d);for(let f=0;f<d;f++)for(let m=0;m<h;m++){let y=m/h,p=f/d,g=t(y*.6,p*2.2)*.35,b=.5+Math.sin((p*9+g*6)*Math.PI*2)*.1+n(y*3,p*3)*.14+(s(y,p)-.5)*.16,v=p*4%1;(v<.012||v>.988)&&(b-=.42);let w=n(y*7+3.1,p*.4);w>.86&&(b-=(w-.86)*2.2);let T=Math.max(0,Math.min(1,b))*255,R=(f*h+m)*4;u.data[R]=u.data[R+1]=u.data[R+2]=T,u.data[R+3]=255}c.putImageData(u,0,0)}),a=ln(i,i,(c,h,d)=>{let u=c.createImageData(h,d),f=[124,84,50],m=[78,49,27],y=[176,133,88];for(let p=0;p<d;p++)for(let g=0;g<h;g++){let S=g/h,b=p/d,v=t(S*.6,b*2.2)*.35,w=Math.sin((b*9+v*6)*Math.PI*2)*.5+.5,T=e(S*1.6,b*1.6),R=w*.55+T*.45+(s(S,b)-.5)*.16,_=[f[0]+(y[0]-f[0])*R+(m[0]-f[0])*(1-R)*.7,f[1]+(y[1]-f[1])*R+(m[1]-f[1])*(1-R)*.7,f[2]+(y[2]-f[2])*R+(m[2]-f[2])*(1-R)*.7],E=b*4%1;(E<.014||E>.986)&&(_=[46,29,16]);let P=Math.pow(Math.max(0,Ye(i,3,3,77)(S,b)),1.6),C=1-Math.min(1,Math.hypot(S-.5,b-.5)*1.9),D=Math.min(.55,P*C*1.5);_=[_[0]+(238-_[0])*D,_[1]+(232-_[1])*D,_[2]+(218-_[2])*D];let W=(p*h+g)*4;u.data[W]=_[0],u.data[W+1]=_[1],u.data[W+2]=_[2],u.data[W+3]=255}c.putImageData(u,0,0)}),o=ln(i,i,(c,h,d)=>{let u=c.createImageData(h,d);for(let f=0;f<d;f++)for(let m=0;m<h;m++){let y=m/h,p=f/d,S=.92-(1-Math.min(1,Math.hypot(y-.5,p-.5)*1.9))*.26+(n(y*5,p*5)-.5)*.18,b=Math.max(0,Math.min(1,S))*255,v=(f*h+m)*4;u.data[v]=u.data[v+1]=u.data[v+2]=b,u.data[v+3]=255}c.putImageData(u,0,0)}),l={map:gn(a,{srgb:!0,repeat:[1,1]}),roughnessMap:gn(o,{repeat:[1,1]}),normalMap:gn(Yi(r,1.6),{repeat:[1,1]})};return He.set("wood",l),l}function Ic(){if(He.has("linen"))return He.get("linen");let i=512,t=Ye(i,24,3,5),e=Ye(i,3,4,61),n=ln(i,i,(a,o,l)=>{let c=a.createImageData(o,l);for(let h=0;h<l;h++)for(let d=0;d<o;d++){let u=d/o,f=h/l,m=34,y=Math.floor(u*m),p=Math.floor(f*m),g=u*m%1,S=f*m%1,b=(y+p)%2===0,v=Math.sin(g*Math.PI),w=Math.sin(S*Math.PI),T=b?.35+v*.55:.35+w*.55;T+=(t(u,f)-.5)*.22;let R=Math.max(0,Math.min(1,T))*255,_=(h*o+d)*4;c.data[_]=c.data[_+1]=c.data[_+2]=R,c.data[_+3]=255}a.putImageData(c,0,0)}),s=ln(i,i,(a,o,l)=>{let c=a.createImageData(o,l);for(let h=0;h<l;h++)for(let d=0;d<o;d++){let u=d/o,f=h/l,m=34,y=Math.floor(u*m),p=Math.floor(f*m),S=(y+p)%2===0?[211,196,168]:[204,189,161],b=t(u,f);S=S.map(R=>R*(.88+b*.24));let v=Math.pow(Math.max(0,e(u,f)-.42)/.58,1.4);S=[S[0]-v*46,S[1]-v*40,S[2]-v*26];let w=Math.pow(Math.max(0,Ye(i,7,3,91)(u,f)-.35)/.65,1.1);S=[S[0]+(247-S[0])*w*.62,S[1]+(243-S[1])*w*.62,S[2]+(232-S[2])*w*.62];let T=(h*o+d)*4;c.data[T]=S[0],c.data[T+1]=S[1],c.data[T+2]=S[2],c.data[T+3]=255}a.putImageData(c,0,0)}),r={map:gn(s,{srgb:!0}),normalMap:gn(Yi(n,1.1))};return He.set("linen",r),r}function Ci(i=0){let t="brick"+i;if(He.has(t))return He.get(t);let e=1024,n=Ye(e,60,3,13),s=Ye(e,4,4,41),r=7,a=3.5,o=(d,u)=>{let f=u*r,m=Math.floor(f),y=m%2*.5,p=d*a+y,g=Math.floor(p);return{fx:p-g,fy:f-m,id:(m*71+g*131)%997}},l=ln(e,e,(d,u,f)=>{let m=d.createImageData(u,f),y=.055;for(let p=0;p<f;p++)for(let g=0;g<u;g++){let S=g/u,b=p/f,v=o(S,b),w=Math.min(v.fx,1-v.fx),T=Math.min(v.fy,1-v.fy),R;if(w<y*.6||T<y*2.4)R=.22+n(S*2,b*2)*.1;else{R=.66+Bo(v.id)()*.1+(n(S,b)-.5)*.14;let C=Math.min(w/y,T/(y*2.4));R-=Math.max(0,1-C)*.1}let _=Math.max(0,Math.min(1,R))*255,E=(p*u+g)*4;m.data[E]=m.data[E+1]=m.data[E+2]=_,m.data[E+3]=255}d.putImageData(m,0,0)}),c=ln(e,e,(d,u,f)=>{let m=d.createImageData(u,f),y=.055;for(let p=0;p<f;p++)for(let g=0;g<u;g++){let S=g/u,b=p/f,v=o(S,b),w=Math.min(v.fx,1-v.fx),T=Math.min(v.fy,1-v.fy),R;if(w<y*.6||T<y*2.4)R=[146,138,126];else{let D=Bo(v.id)();R=[118+D*26,92+D*20,78+D*16]}let _=n(S*1.5,b*1.5);R=R.map(C=>C*(.82+_*.34));let E=i*Math.pow(Math.max(0,s(S,b)),1.1)*(.35+.65*b);R=[R[0]*(1-E*.82),R[1]*(1-E*.85),R[2]*(1-E*.86)];let P=(p*u+g)*4;m.data[P]=R[0],m.data[P+1]=R[1],m.data[P+2]=R[2],m.data[P+3]=255}d.putImageData(m,0,0)}),h={map:gn(c,{srgb:!0}),normalMap:gn(Yi(l,2.2))};return He.set(t,h),h}function Vu(){if(He.has("plaster"))return He.get("plaster");let i=512,t=Ye(i,5,4,3),e=Ye(i,48,2,19),n=ln(i,i,(a,o,l)=>{let c=a.createImageData(o,l);for(let h=0;h<l;h++)for(let d=0;d<o;d++){let u=d/o,f=h/l,m=.5+(t(u,f)-.5)*.5+(e(u,f)-.5)*.14,y=Math.max(0,Math.min(1,m))*255,p=(h*o+d)*4;c.data[p]=c.data[p+1]=c.data[p+2]=y,c.data[p+3]=255}a.putImageData(c,0,0)}),s=ln(i,i,(a,o,l)=>{let c=a.createImageData(o,l);for(let h=0;h<l;h++)for(let d=0;d<o;d++){let u=d/o,f=h/l,m=t(u,f),p=[231,218,199].map(b=>b*(.9+m*.16)),g=Math.pow(f,2.2)*.1,S=(h*o+d)*4;c.data[S]=p[0]*(1-g),c.data[S+1]=p[1]*(1-g*1.05),c.data[S+2]=p[2]*(1-g*1.1),c.data[S+3]=255}a.putImageData(c,0,0)}),r={map:gn(s,{srgb:!0}),normalMap:gn(Yi(n,1))};return He.set("plaster",r),r}function Hu(){if(He.has("crust"))return He.get("crust");let i=1024,t=Ye(i,52,3,7),e=Ye(i,14,4,29),n=Ye(i,26,3,53),s=ln(i,i,(o,l,c)=>{let h=o.createImageData(l,c),d=Bo(99),u=[];for(let f=0;f<900;f++)u.push([d(),d(),.002+d()*.0075]);for(let f=0;f<c;f++)for(let m=0;m<l;m++){let y=m/l,p=f/c,g=.5+(t(y,p)-.5)*.3+(e(y,p)-.5)*.16,S=(f*l+m)*4;h.data[S]=h.data[S+1]=h.data[S+2]=Math.max(0,Math.min(1,g))*255,h.data[S+3]=255}o.putImageData(h,0,0),o.globalCompositeOperation="lighter";for(let[f,m,y]of u){let p=o.createRadialGradient(f*l,m*c,0,f*l,m*c,y*l);p.addColorStop(0,"rgba(255,255,255,0.55)"),p.addColorStop(.6,"rgba(255,255,255,0.16)"),p.addColorStop(1,"rgba(255,255,255,0)"),o.fillStyle=p,o.beginPath(),o.arc(f*l,m*c,y*l,0,Math.PI*2),o.fill()}o.globalCompositeOperation="source-over"}),r=ln(i,i,(o,l,c)=>{let h=o.createImageData(l,c);for(let d=0;d<c;d++)for(let u=0;u<l;u++){let f=u/l,m=d/c,y=.5+(e(f,m)-.5)*.55+(t(f,m)-.5)*.3,p=Math.pow(Math.max(0,n(f,m)-.34)/.66,1.3),g=Math.pow(Math.max(0,t(f,m)-.5)*2,1.5),S=(d*l+u)*4;h.data[S]=Math.max(0,Math.min(1,y))*255,h.data[S+1]=p*255,h.data[S+2]=g*255,h.data[S+3]=255}o.putImageData(h,0,0)}),a={detail:gn(r,{repeat:[1,1]}),normalMap:gn(Yi(s,2.2),{repeat:[1,1]})};return He.set("crust",a),a}function ko(){if(He.has("iron"))return He.get("iron");let i=512,t=Ye(i,70,3,17),e=Ye(i,6,4,37),n=ln(i,i,(a,o,l)=>{let c=a.createImageData(o,l);for(let h=0;h<l;h++)for(let d=0;d<o;d++){let u=d/o,f=h/l,m=e(u,f),y=[56+m*34,52+m*30,50+m*26],p=Math.pow(Math.max(0,e(u*2.3+1.7,f*2.3)-.62)/.38,1.4);y=[y[0]+(126-y[0])*p,y[1]+(66-y[1])*p,y[2]+(34-y[2])*p];let g=t(u*3,f*.4);y=y.map(b=>b*(.86+g*.3));let S=(h*o+d)*4;c.data[S]=y[0],c.data[S+1]=y[1],c.data[S+2]=y[2],c.data[S+3]=255}a.putImageData(c,0,0)}),s=ln(i,i,(a,o,l)=>{let c=a.createImageData(o,l);for(let h=0;h<l;h++)for(let d=0;d<o;d++){let u=d/o,f=h/l,m=t(u*3,f*.4),p=.42+e(u,f)*.42+(m-.5)*.18,g=Math.max(0,Math.min(1,p))*255,S=(h*o+d)*4;c.data[S]=c.data[S+1]=c.data[S+2]=g,c.data[S+3]=255}a.putImageData(c,0,0)}),r={map:gn(n,{srgb:!0}),roughnessMap:gn(s)};return He.set("iron",r),r}function Gu(){return ln(512,256,(e,n,s)=>{let r=e.createLinearGradient(0,0,0,s);r.addColorStop(0,"#efe6d8"),r.addColorStop(.45,"#d8cbb6"),r.addColorStop(.55,"#9c8469"),r.addColorStop(1,"#54402d"),e.fillStyle=r,e.fillRect(0,0,n,s);let a=e.createRadialGradient(n*.2,s*.34,4,n*.2,s*.34,n*.16);a.addColorStop(0,"#ffffff"),a.addColorStop(.45,"#f3f0e6"),a.addColorStop(1,"rgba(240,236,224,0)"),e.fillStyle=a,e.fillRect(0,0,n,s);let o=e.createRadialGradient(n*.62,s*.12,2,n*.62,s*.12,n*.1);o.addColorStop(0,"#fff3d8"),o.addColorStop(1,"rgba(255,243,216,0)"),e.fillStyle=o,e.fillRect(0,0,n,s);let l=e.createRadialGradient(n*.8,s*.52,2,n*.8,s*.52,n*.13);l.addColorStop(0,"#ff9c3c"),l.addColorStop(.5,"rgba(214,110,34,0.45)"),l.addColorStop(1,"rgba(190,90,20,0)"),e.fillStyle=l,e.fillRect(0,0,n,s)})}var wt={benchTop:.92,benchW:2.3,benchD:.98,benchTh:.065,ovenFront:-2.85,mouthW:1.34,mouthH:.6,mouthY:1.25,deckY:.96,ovenDepth:1.15};function Dc(i,t,e){let n=new ri,s=-i/2,r=-t/2;return n.moveTo(s+e,r),n.lineTo(s+i-e,r),n.quadraticCurveTo(s+i,r,s+i,r+e),n.lineTo(s+i,r+t-e),n.quadraticCurveTo(s+i,r+t,s+i-e,r+t),n.lineTo(s+e,r+t),n.quadraticCurveTo(s,r+t,s,r+t-e),n.lineTo(s,r+e),n.quadraticCurveTo(s,r,s+e,r),n}function Ge(i,t,e,n=.006,s=2){let r=new kn(Dc(i,t,Math.min(n*3,i/2,t/2)),{depth:Math.max(.001,e-n*2),bevelEnabled:!0,bevelThickness:n,bevelSize:n,bevelSegments:s,curveSegments:4});return r.translate(0,0,-(e-n*2)/2),r.computeVertexNormals(),r}function Lc(i,t){let e=i.attributes.uv;if(!e)return i;for(let n=0;n<e.count;n++)e.setXY(n,e.getX(n)*t,e.getY(n)*t);return e.needsUpdate=!0,i}function je(i,t=1){let e=i.attributes.position,n=i.attributes.normal,s=new Float32Array(e.count*2);for(let r=0;r<e.count;r++){let a=e.getX(r),o=e.getY(r),l=e.getZ(r),c=Math.abs(n.getX(r)),h=Math.abs(n.getY(r)),d=Math.abs(n.getZ(r)),u,f;h>=c&&h>=d?(u=a,f=l):c>=d?(u=l,f=o):(u=a,f=o),s[r*2]=u*t,s[r*2+1]=f*t}return i.setAttribute("uv",new ye(s,2)),i}function Wu(){let i=new be,t=Vu(),e=new Qt({map:t.map,normalMap:t.normalMap,roughness:.94,metalness:0});e.map.repeat.set(1,1),e.normalScale.set(.7,.7);let n=new Qt({map:Ci(.35).map,normalMap:Ci(.35).normalMap,roughness:.88,metalness:0,color:10129284}),s=new Tt(new $e(14,14),n);s.rotation.x=-Math.PI/2,s.receiveShadow=!0,je(s.geometry,1.55),s.geometry.attributes.uv.needsUpdate=!0,i.add(s);let r=new Tt(new $e(15,3.6),e.clone());r.position.set(0,1.8,-6.3),r.receiveShadow=!0,Lc(r.geometry,3),i.add(r);let a=new Tt(new $e(13,3.6),e.clone());a.rotation.y=Math.PI/2,a.position.set(-4.3,1.8,-1.6),a.receiveShadow=!0,Lc(a.geometry,2.6),i.add(a);let o=new Tt(new $e(13,3.6),e.clone());o.rotation.y=-Math.PI/2,o.position.set(4.3,1.8,-1.6),o.receiveShadow=!0,Lc(o.geometry,2.6),i.add(o);let l=new Tt(new $e(15,15),new Qt({color:15129028,roughness:1}));l.rotation.x=Math.PI/2,l.position.y=3.2,i.add(l);let c=f_(),h=new Qt({color:14669508,roughness:.22,metalness:0,map:d_(),normalMap:c});h.normalScale.set(.8,.8);let d=new Tt(new $e(15,1.3),h);d.position.set(0,.65,-6.28),d.receiveShadow=!0,i.add(d);let u=new Tt(Ge(15,.05,.035,.004),new Qt({color:8017974,roughness:.75}));u.position.set(0,1.31,-6.26),i.add(u);let f=new be,m=new Tt(new $e(1.7,1.62),new ii({color:16775920,toneMapped:!1}));m.rotation.y=Math.PI/2,m.position.set(-4.27,1.78,-.5),f.add(m);let y=new Qt({color:15985888,roughness:.6}),p=[[.05,1.62,.05,0,0],[.05,.05,1.66,0,0]];for(let[S,b,v,w,T]of p){let R=new Tt(Ge(v,b,S,.006),y);R.position.set(-4.25,1.78+w,-.5+T),f.add(R)}let g=new Tt(Ge(.2,.05,1.72,.008),y);return g.position.set(-4.19,.99,-.5),g.castShadow=!0,f.add(g),i.add(f),i}function d_(){let t=document.createElement("canvas");t.width=t.height=512;let e=t.getContext("2d");e.fillStyle="#b9ad98",e.fillRect(0,0,512,512);let n=8,s=512/n;for(let a=0;a<n;a++)for(let o=0;o<n;o++){let l=(o*7+a*13)%5/5;e.fillStyle=`rgb(${232-l*14},${226-l*12},${212-l*10})`,e.fillRect(o*s+2,a*s+2,s-4,s-4),e.strokeStyle=`rgba(150,138,120,${.05+l*.08})`,e.lineWidth=1,e.beginPath(),e.moveTo(o*s+s*.2,a*s+s*.1),e.lineTo(o*s+s*(.4+l*.4),a*s+s*.9),e.stroke()}let r=new yn(t);return r.wrapS=r.wrapT=ti,r.repeat.set(10,1),r.colorSpace=Se,r.anisotropy=8,r}function f_(){let t=document.createElement("canvas");t.width=t.height=512;let e=t.getContext("2d");e.fillStyle="#000",e.fillRect(0,0,512,512);let n=8,s=512/n;for(let a=0;a<n;a++)for(let o=0;o<n;o++){e.fillStyle="#e8e8e8";let l=4,c=o*s+3,h=a*s+3,d=s-6,u=s-6;e.beginPath(),e.moveTo(c+l,h),e.arcTo(c+d,h,c+d,h+u,l),e.arcTo(c+d,h+u,c,h+u,l),e.arcTo(c,h+u,c,h,l),e.arcTo(c,h,c+d,h,l),e.closePath(),e.fill()}let r=new yn(Yi(t,2.6));return r.wrapS=r.wrapT=ti,r.repeat.set(10,1),r}function Xu(){let i=new be,t=zo(),e=new Qt({map:t.map,roughnessMap:t.roughnessMap,normalMap:t.normalMap,roughness:1,metalness:0});e.normalScale.set(.85,.85);let n=wt.benchW,s=wt.benchD,r=wt.benchTh,a=new Tt(Ge(n,r,s,.008,3),e);je(a.geometry,1.45),a.position.set(0,wt.benchTop-r/2,0),a.castShadow=!0,a.receiveShadow=!0,i.add(a);let o=new Qt({map:t.map,normalMap:t.normalMap,roughness:.95,metalness:0,color:10254930}),l=new Tt(Ge(n-.14,.1,s-.14,.006),o);je(l.geometry,1.45),l.position.set(0,wt.benchTop-r-.055,0),l.castShadow=!0,l.receiveShadow=!0,i.add(l);let c=.085;for(let d of[-1,1])for(let u of[-1,1]){let f=new Tt(Ge(c,wt.benchTop-r-.02,c,.005),o);je(f.geometry,1.45),f.position.set(d*(n/2-.11),(wt.benchTop-r)/2,u*(s/2-.11)),f.castShadow=!0,f.receiveShadow=!0,i.add(f)}let h=new Tt(Ge(n-.24,.035,s-.24,.005),o);return je(h.geometry,1.45),h.position.set(0,.26,0),h.castShadow=!0,h.receiveShadow=!0,i.add(h),i}function qu(i=1.35,t=.62,e=3,n=.115){let s=Ic(),r=new Qt({map:s.map,normalMap:s.normalMap,roughness:.95,metalness:0,side:qe});r.map.repeat.set(i/.115,t/.115),r.normalMap.repeat.set(i/.115,t/.115),r.normalScale.set(.55,.55);let a=64,o=96,l=new $e(i,t,a,o);l.rotateX(-Math.PI/2);let c=l.attributes.position;for(let d=0;d<c.count;d++){let u=c.getX(d),f=c.getZ(d),m=f/n,y=Math.abs((m%1+1)%1-.5)*2,p=(1-Math.cos(Math.PI*y))*.5*.044,g=Math.max(0,Math.abs(u)/(i/2)-.8)/.2;p-=g*g*.012,p+=Math.sin(u*7.3+f*3.1)*.0022+Math.cos(u*3.1-f*9.7)*.0018,c.setY(d,p)}l.computeVertexNormals();let h=new Tt(l,r);return h.castShadow=!0,h.receiveShadow=!0,h.userData.pitch=n,h}function Yu(){let i=new be,t=Ci(1),e=new Qt({map:t.map,normalMap:t.normalMap,roughness:.95,metalness:0});e.normalScale.set(1.1,1.1);let n=2.45,s=2.2,r=wt.ovenDepth,a=wt.ovenFront,o=new ri;o.moveTo(-n/2,0),o.lineTo(n/2,0),o.lineTo(n/2,s),o.lineTo(-n/2,s),o.closePath();let l=wt.mouthW/2,c=wt.mouthY-wt.mouthH/2,h=wt.mouthY+wt.mouthH/2,d=new yi;d.moveTo(-l,c),d.lineTo(l,c),d.lineTo(l,h-.1),d.quadraticCurveTo(l,h,l-.1,h),d.lineTo(-l+.1,h),d.quadraticCurveTo(-l,h,-l,h-.1),d.closePath(),o.holes.push(d);let u=new kn(o,{depth:.3,bevelEnabled:!0,bevelThickness:.012,bevelSize:.012,bevelSegments:2,curveSegments:8});u.translate(0,0,-.3),u.computeVertexNormals(),je(u,2.25);let f=new Tt(u,e);f.position.set(0,0,a),f.castShadow=!0,f.receiveShadow=!0,i.add(f);let m=wt.mouthW+.2,y=r,p=wt.deckY,g=.62,S=new ri;S.moveTo(-n/2,0),S.lineTo(n/2,0),S.lineTo(n/2,s),S.lineTo(-n/2,s),S.closePath();let b=new yi,v=m/2,w=p+g,T=Math.min(v*.8,g*.5);b.moveTo(-v,p),b.lineTo(v,p),b.lineTo(v,w-T),b.quadraticCurveTo(v,w,v-T,w),b.lineTo(-v+T,w),b.quadraticCurveTo(-v,w,-v,w-T),b.closePath(),S.holes.push(b);let R=new kn(S,{depth:r,bevelEnabled:!1,curveSegments:12});R.translate(0,0,-r),R.computeVertexNormals(),je(R,2.25);let _=new Tt(R,e);_.position.set(0,0,a-.3),_.castShadow=!0,_.receiveShadow=!0,i.add(_);let E=Ge(n,s,.16,.01);je(E,2.25);let P=new Tt(E,new Qt({map:t.map,normalMap:t.normalMap,roughness:.96,metalness:0,color:6245698}));P.position.set(0,s/2,a-.3-r-.08),P.castShadow=!0,P.receiveShadow=!0,i.add(P);let C=new Tt(Ge(n+.14,.09,r+.42,.01),new Qt({color:9339253,roughness:.9}));C.position.set(0,s+.045,a-.3-r/2+.06),C.castShadow=!0,C.receiveShadow=!0,i.add(C);let D=new Tt(new Ve(.13,.15,1,20,1,!0),new Qt({...ko(),roughness:.75,metalness:.65,side:qe,color:7234909}));D.position.set(.55,s+.55,a-.9),D.castShadow=!0,i.add(D);let W=new be,X=new Qt({map:Ci(1).map,normalMap:Ci(1).normalMap,roughness:.94,metalness:0,color:8876127}),O=new $e(m-.006,r+.34,1,1);O.rotateX(-Math.PI/2),je(O,2.6);let H=new Tt(O,X);H.position.set(0,wt.deckY+.004,a-.3-r/2+.02),H.receiveShadow=!0,W.add(H),i.add(W);let V=new Qt({color:9273717,roughness:.88,metalness:0,map:Ci(.8).map,normalMap:Ci(.8).normalMap}),K=new Tt(Ge(wt.mouthW+.42,.13,.14,.008),V);je(K.geometry,2),K.position.set(0,h+.075,a+.055),K.castShadow=!0,K.receiveShadow=!0,i.add(K);let et=new Tt(Ge(wt.mouthW+.42,.075,.2,.008),V);je(et.geometry,2),et.position.set(0,c-.03,a+.085),et.castShadow=!0,et.receiveShadow=!0,i.add(et);for(let tt of[-1,1]){let pt=new Tt(Ge(.16,wt.mouthH+.1,.1,.008),V);je(pt.geometry,2),pt.position.set(tt*(l+.08),wt.mouthY,a+.035),pt.castShadow=!0,pt.receiveShadow=!0,i.add(pt)}let ot=ko(),ct=new Qt({map:ot.map,roughnessMap:ot.roughnessMap,roughness:1,metalness:.72}),it=new be;it.position.set(0,h+.02,a+.012);let zt=wt.mouthW+.16,$t=wt.mouthH+.12,Zt=new Tt(Ge(zt,$t,.032,.006),ct);je(Zt.geometry,2.4),Zt.position.set(0,-$t/2,0),Zt.castShadow=!0,Zt.receiveShadow=!0,it.add(Zt);let Z=new Qt({color:3354668,roughness:.62,metalness:.75});for(let[tt,pt,Ft,Pt]of[[zt,.03,0,-.02],[zt,.03,0,-$t+.02],[.03,$t,-zt/2+.016,-$t/2],[.03,$t,zt/2-.016,-$t/2]]){let ne=new Tt(Ge(tt,pt,.012,.003),Z);ne.position.set(Ft,Pt,.021),ne.castShadow=!0,it.add(ne)}for(let tt=0;tt<8;tt++){let pt=new Tt(new Rn(.008,10,8),Z),Ft=-zt/2+.05+(zt-.1)*(tt/7);pt.position.set(Ft,-.02,.028),it.add(pt);let Pt=pt.clone();Pt.position.y=-$t+.02,it.add(Pt)}for(let tt of[-1,1]){let pt=new Tt(new Ve(.016,.016,.07,12),Z);pt.rotation.z=Math.PI/2,pt.position.set(tt*(zt/2-.09),.005,.005),pt.castShadow=!0,it.add(pt)}let at=new Tt(new Ss(.055,.011,8,20,Math.PI),new Qt({color:3025446,roughness:.5,metalness:.8}));return at.rotation.x=Math.PI/2,at.position.set(0,-$t+.035,.048),at.castShadow=!0,it.add(at),i.add(it),{group:i,doorPivot:it,innerCenter:new I(0,wt.deckY,a-.3-r*.5)}}function Zu(i){let t=new be,e=zo(),n=new Qt({map:e.map,normalMap:e.normalMap,roughness:.92,color:10255187});for(let s=0;s<3;s++){let r=1.2+s*.56,a=new Tt(Ge(3,.045,.36,.005),n);je(a.geometry,.7),a.position.set(2.25,r,-6),a.rotation.y=0,a.castShadow=!0,a.receiveShadow=!0,t.add(a);for(let o of[-1,0,1]){let l=new Tt(Ge(.05,.2,.3,.004),n);l.position.set(2.25+o,r-.12,-6.01),l.castShadow=!0,t.add(l)}}return t}function Ku(){let i=new be,t=ko(),e=new Qt({color:12173252,roughness:.42,metalness:.85,map:t.map}),n=.8,s=.36;for(let r=0;r<17;r++){let a=new Tt(new Ve(.0028,.0028,s,6),e);a.rotation.x=Math.PI/2,a.position.set(-n/2+n*r/16,0,0),a.castShadow=!0,i.add(a)}for(let r of[-s/2+.03,0,s/2-.03]){let a=new Tt(new Ve(.0038,.0038,n,6),e);a.rotation.z=Math.PI/2,a.position.set(0,-.005,r),a.castShadow=!0,i.add(a)}for(let r of[-1,1])for(let a of[-1,1]){let o=new Tt(new Ve(.004,.004,.022,6),e);o.position.set(r*(n/2-.05),-.014,a*(s/2-.05)),i.add(o)}return i}function Ju(){let i=new be,t=new Qt({color:11106111,roughness:.62,metalness:0}),e=new Tt(new Ve(.008,.0092,.112,18),t);e.castShadow=!0,i.add(e);let n=new Tt(new Ve(.0086,.0086,.012,18),new Qt({color:14212577,roughness:.3,metalness:.9}));n.position.y=.062,i.add(n);let s=new ri;s.moveTo(-.008,0),s.quadraticCurveTo(-.01,.02,-.002,.034),s.quadraticCurveTo(.006,.022,.006,0),s.closePath();let r=new kn(s,{depth:4e-4,bevelEnabled:!1}),a=new Tt(r,new Qt({color:15133938,roughness:.12,metalness:1,side:qe}));return a.position.y=.066,a.castShadow=!0,i.add(a),i}function $u(){let i=new be,t=zo(),e=new Qt({map:t.map,normalMap:t.normalMap,roughness:.86,metalness:0,color:14201987}),n=Dc(.42,.62,.03),s=new kn(n,{depth:.011,bevelEnabled:!0,bevelThickness:.002,bevelSize:.004,bevelSegments:2,curveSegments:6});s.rotateX(-Math.PI/2),s.computeVertexNormals(),je(s,1.1);let r=new Tt(s,e);r.castShadow=!0,r.receiveShadow=!0,i.add(r);let a=Dc(.42,.16,.02),o=new kn(a,{depth:.004,bevelEnabled:!1});o.rotateX(-Math.PI/2),o.computeVertexNormals(),je(o,1.1);let l=new Tt(o,e);l.position.set(0,.0035,-.38),l.castShadow=!0,l.receiveShadow=!0,i.add(l);let c=new Tt(new Ve(.017,.019,.55,14),e);c.rotation.x=Math.PI/2,c.position.set(0,.006,.58),c.castShadow=!0,i.add(c);let h=new Tt(new Rn(.024,14,10),e);return h.position.set(0,.006,.855),h.castShadow=!0,i.add(h),i}function Qu(){let i=new be,t=new Qt({color:13226198,roughness:.32,metalness:.9}),e=new Tt(Ge(.15,.001,.105,5e-4),t);e.castShadow=!0,e.receiveShadow=!0,i.add(e);let n=new Tt(Ge(.15,.022,.026,.006),new Qt({color:7293740,roughness:.7}));return n.position.set(0,.011,-.048),n.castShadow=!0,i.add(n),i}function ju(){let i=new be,t=new Qt({color:11975874,roughness:.38,metalness:.85}),e=new Tt(new Ve(.038,.042,.105,24),t);e.position.y=.052,e.castShadow=!0,e.receiveShadow=!0,i.add(e);let n=new Tt(new Ve(.036,.039,.022,24),t);n.position.y=.114,n.castShadow=!0,i.add(n);let s=new Tt(new Rn(.008,12,10),t);return s.position.y=.128,i.add(s),i}function td(i=.34,t=.3){let e=Ic(),n=new Qt({map:e.map,normalMap:e.normalMap,roughness:.95,side:qe,color:15261903}),s=new $e(i,t,24,24),r=s.attributes.position;for(let o=0;o<r.count;o++){let l=r.getX(o),h=(r.getY(o)+t/2)/t;r.setZ(o,Math.sin(l*22+.4)*.01*(1-h)+Math.sin(l*9)*.006),r.setX(o,l*(.86+.14*h))}s.computeVertexNormals();let a=new Tt(s,n);return a.castShadow=!0,a.receiveShadow=!0,a}function Nc(i=.13,t=.1){let e=new be,n=new Qt({color:11107398,roughness:.9}),s=5;for(let a=0;a<s;a++){let o=t*(a+.5)/s,l=i*(.86+.14*(a/s)),c=new Tt(new Ss(l,.0075,6,30),n);c.rotation.x=Math.PI/2,c.position.y=o,c.castShadow=!0,c.receiveShadow=!0,e.add(c)}let r=new Tt(new Ve(i*.86,i*.8,.012,26),n);return r.position.y=.006,r.receiveShadow=!0,e.add(r),e}var Vo=class{constructor(t){let e=new Uo({canvas:t,antialias:!0,powerPreference:"high-performance",alpha:!1,stencil:!1,preserveDrawingBuffer:!0});e.setPixelRatio(Math.min(window.devicePixelRatio||1,2)),e.outputColorSpace=Se,e.toneMapping=yr,e.toneMappingExposure=1,e.shadowMap.enabled=!0,e.shadowMap.type=Gi,this.renderer=e;let n=new js;n.background=new Yt(2759698),n.fog=new Qs(11901564,.115),this.scene=n,this.camera=new ze(38,1,.03,40),this.camera.position.set(0,1.55,.95),this._buildLights(),this._buildEnv()}_buildEnv(){let t=new Is(this.renderer);t.compileEquirectangularShader();let e=new yn(Gu());e.mapping=Es,e.colorSpace=Se;let n=t.fromEquirectangular(e);this.scene.environment=n.texture,this.scene.environmentIntensity=.38,e.dispose(),t.dispose()}_buildLights(){let t=new xr(16773334,6.4);t.position.set(-4,3.4,2.2),t.target.position.set(0,wt.benchTop,-.35),t.castShadow=!0,t.shadow.mapSize.set(1536,1536);let e=t.shadow.camera;e.left=-2.4,e.right=2.4,e.top=2.4,e.bottom=-2.4,e.near=1,e.far=12,t.shadow.bias=-6e-4,t.shadow.normalBias=.012,t.shadow.radius=2.2,this.scene.add(t,t.target),this.key=t;let n=new Hi(16765600,4.2,7,2);n.position.set(.15,2.62,-.25),this.scene.add(n),this.lamp=n;let s=new Tt(new Rn(.035,16,12),new ii({color:16771524,toneMapped:!1}));s.position.copy(n.position),this.scene.add(s);let r=new Tt(new rr(.19,.16,24,1,!0),new Qt({color:3090982,roughness:.5,metalness:.5,side:qe}));r.position.set(n.position.x,n.position.y+.1,n.position.z),this.scene.add(r);let a=new Tt(new Ve(.003,.003,.42,6),new Qt({color:2762274,roughness:.8}));a.position.set(n.position.x,n.position.y+.38,n.position.z),this.scene.add(a);let o=new pr(15128253,4206623,.34);this.scene.add(o),this.hemi=o;let l=new _r(16747060,0,5,1.05,.62,1.5);l.position.set(0,wt.mouthY+.1,wt.ovenFront-.45),l.target.position.set(0,wt.deckY,wt.ovenFront-.95),l.castShadow=!0,l.shadow.mapSize.set(768,768),l.shadow.camera.near=.05,l.shadow.camera.far=3,l.shadow.bias=-.0012,l.shadow.normalBias=.008,this.scene.add(l,l.target),this.ovenLight=l;let c=new Hi(16749632,0,2.2,2);c.position.set(0,wt.deckY+.3,wt.ovenFront-1.3),this.scene.add(c),this.ovenRim=c;let h=new Hi(16747056,0,3.2,2);h.position.set(0,wt.mouthY,wt.ovenFront+.22),this.scene.add(h),this.ovenSpill=h}setOvenHeat(t){let e=1+Math.sin(performance.now()*.006)*.045+Math.sin(performance.now()*.017)*.028;this.ovenLight.intensity=5*t*e,this.ovenSpill.intensity=1.7*t*e,this.ovenRim.intensity=1.5*t*(2-e)}setInterior(t){this.hemi.intensity=.34-.25*t,this.scene.environmentIntensity=.38-.26*t,this.key.intensity=6.4-4.9*t,this.lamp.intensity=4.2-3.4*t,this.renderer.toneMappingExposure=1-.1*t,this.scene.fog.color.setHex(t>.5?4860438:11901564)}resize(t,e,n){this.renderer.setPixelRatio(n),this.renderer.setSize(t,e,!1),this.camera.aspect=t/e,this.camera.updateProjectionMatrix()}render(){this.renderer.render(this.scene,this.camera)}};var ed={normal:{len:.6,rad:.0295,cuts:4},petite:{len:.4,rad:.0215,cuts:3},batard:{len:.33,rad:.045,cuts:3},free:{len:.6,rad:.031,cuts:5}},p_=.36,m_=.78,g_=.2,__=.27,x_=.82,v_=1,y_=208,M_=144;function nd(i){let t=i>>>0;return()=>{t|=0,t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}var tn=(i,t,e)=>i<t?t:i>e?e:i,Ie=(i,t,e)=>i+(t-i)*e,Zi=i=>(i=tn(i,0,1),i*i*(3-2*i)),Go=(i,t,e)=>tn((i-t)/(e-t),0,1),S_=i=>1-Math.pow(1-tn(i,0,1),3),Ho=(i,t,e)=>{let n=tn((e-i)/(t-i),0,1);return n*n*(3-2*n)},b_=[[0,15590091],[.16,15391932],[.32,15127204],[.48,14465916],[.63,13541205],[.79,12157244],[1,10380585]],T_=[[0,16051419],[.35,15919053],[.62,15654324],[.85,15257760],[1,14861454]];function id(i,t){t=tn(t,0,1);for(let n=0;n<i.length-1;n++){let[s,r]=i[n],[a,o]=i[n+1];if(t>=s&&t<=a){let l=(t-s)/(a-s),c=Ie(r>>16&255,o>>16&255,l),h=Ie(r>>8&255,o>>8&255,l),d=Ie(r&255,o&255,l);return[c/255,h/255,d/255]}}let e=i[i.length-1][1];return[(e>>16&255)/255,(e>>8&255)/255,(e&255)/255]}function E_(i){return Zi(Go(i,.04,.52))*.78+Go(i,.45,1)*.22}function w_(){let i=Hu(),t=new Qt({color:16777215,roughness:.62,metalness:0,normalMap:i.normalMap,normalScale:new ht(.72,.72)});return t.userData.uniforms={uCrust:{value:new Yt(.93,.89,.8)},uCrumb:{value:new Yt(.95,.91,.84)},uBake:{value:0},uFlour:{value:1},uDetail:{value:i.detail}},t.onBeforeCompile=e=>{Object.assign(e.uniforms,t.userData.uniforms),e.vertexShader=e.vertexShader.replace("#include <common>",`#include <common>
        attribute float aCrumb;
        attribute float aAO;
        varying float vCrumb;
        varying float vAO;
        varying vec2 vDetailUv;`).replace("#include <begin_vertex>",`#include <begin_vertex>
        vCrumb = aCrumb;
        vAO = aAO;
        vDetailUv = uv;`),e.fragmentShader=e.fragmentShader.replace("#include <common>",`#include <common>
        uniform vec3 uCrust;
        uniform vec3 uCrumb;
        uniform float uBake;
        uniform float uFlour;
        uniform sampler2D uDetail;
        varying float vCrumb;
        varying float vAO;
        varying vec2 vDetailUv;`).replace("#include <map_fragment>",`
        vec4 det = texture2D(uDetail, vDetailUv * vec2(4.2, 1.5));
        float shade = det.r;              // \u713C\u304D\u30E0\u30E9
        float flourMask = det.g;          // \u6253\u3061\u7C89
        float pore = det.b;               // \u6C17\u5B54
        vec3 crust = uCrust;
        // \u713C\u304D\u30E0\u30E9\uFF1A\u713C\u3051\u308B\u307B\u3069\u6FC3\u6DE1\u304C\u51FA\u308B
        crust *= mix(1.0, 0.70 + shade * 0.62, 0.25 + 0.75 * uBake);
        // \u6C17\u5B54\u306E\u5F71
        crust *= 1.0 - pore * 0.20 * (0.3 + 0.7 * uBake);
        // \u30AF\u30E9\u30E0\uFF08\u5207\u308C\u76EE\u306E\u5185\u5074\uFF09
        vec3 base = mix(crust, uCrumb, vCrumb);
        // \u6253\u3061\u7C89\u306F\u76AE\u306E\u4E0A\u306B\u3060\u3051\u6B8B\u308B\uFF08\u30AF\u30E9\u30E0\u306B\u306F\u4E57\u3089\u306A\u3044\uFF09
        float fl = flourMask * uFlour * (1.0 - vCrumb) * 0.55;
        base = mix(base, vec3(0.96, 0.945, 0.90), fl);
        // \u5272\u308C\u76EE\u306E\u4E2D\u306E\u906E\u853D
        base *= vAO;
        diffuseColor.rgb *= base;
      `).replace("#include <roughnessmap_fragment>",`
        float roughnessFactor = roughness;
        roughnessFactor = mix(roughnessFactor - 0.22 * uBake, 0.94, vCrumb);
        roughnessFactor += pore * 0.10;
        roughnessFactor = clamp(roughnessFactor, 0.16, 1.0);
      `),t.userData.shader=e},t.customProgramCacheKey=()=>"crust-v1",t}var Ns=class{constructor(t="normal",e,n={}){this.opts=n,this.typeKey=ed[t]?t:"normal",this.spec=ed[this.typeKey],this.seed=e===void 0?Math.random()*1e9|0:e;let s=nd(this.seed);this.rnd=s,this.press=0,this.roll=0,this.stretch=0,this.proof=0,this.bake=0,this.cool=0,this.scores=[],this.lean=-1,this.wob=[];for(let r=0;r<10;r++)this.wob.push(s()*2-1);this._buildGeometry(),this.material=w_(),this.mesh=new Tt(this.geometry,this.material),this.mesh.castShadow=!0,this.mesh.receiveShadow=!0,this.mesh.frustumCulled=!1,this.mesh.userData.loaf=this,this._tmpPos=new Float32Array(this.vertCount*3),this.rebuild()}_buildGeometry(){let t=this.opts.nu||y_,e=this.opts.nv||M_,n=e+1,s=(t+1)*n;this.vertCount=s,this.nu=t,this.nv=e,this.cols=n;let r=new Float32Array(s*3),a=new Float32Array(s*3),o=new Float32Array(s*2),l=new Float32Array(s),c=new Float32Array(s);c.fill(1);for(let u=0;u<=t;u++)for(let f=0;f<n;f++){let m=u*n+f;o[m*2]=u/t,o[m*2+1]=f/e}let h=[];for(let u=0;u<t;u++)for(let f=0;f<e;f++){let m=u*n+f,y=m+n;h.push(m,m+1,y,m+1,y+1,y)}let d=new Ue;d.setAttribute("position",new ye(r,3)),d.setAttribute("normal",new ye(a,3)),d.setAttribute("uv",new ye(o,2)),d.setAttribute("aCrumb",new ye(l,1)),d.setAttribute("aAO",new ye(c,1)),d.setIndex(h),d.boundingSphere=new An(new I,.5),this.geometry=d}dims(){let t=this.spec,e=Ie(.05,.072,this.press),n=Ie(.05,.038,this.press);e=Ie(e,.1,this.roll),n=Ie(n,.0335,this.roll),e=Ie(e,t.len*.5,this.stretch),n=Ie(n,t.rad,this.stretch),n*=1+.13*this.proof,e*=1+.02*this.proof;let s=E_(this.bake);n*=1+.22*s,e*=1+.045*s,n*=1-.02*this.cool;let r=Zi(Math.max(this.roll,this.stretch));return{hl:e,R:n,logness:r}}_prof(t,e){let n=Math.min(1,Math.abs(t)),s=Math.sqrt(Math.max(0,1-n*n)),r=Math.pow(Math.max(0,1-Math.pow(n,5)),.28);return Ie(s,r,e)}_sect(t){let e=Math.cos(t),n=Math.max(0,-e);return(1+.035*Math.cos(2*t))*(1-.085*n*n)}addScore(t,e,n,s,r,a){let o=this.dims(),l=a?8:5;if(this.scores.length>=l)return null;let c=n-t,h=s-e,d=Math.hypot(c,h);d<1e-5&&(c=1,h=0,d=1e-5);let u=Math.atan2(h,c);u>Math.PI/2&&(u-=Math.PI),u<-Math.PI/2&&(u+=Math.PI),this.scores.length===0&&(this.lean=u>.06?1:-1);let f=this.lean*p_,m;if(a)m=Ie(u,f,g_),m=(Math.sign(m)||1)*tn(Math.abs(m),.12,1.3);else{let C=u;Math.abs(u)>.05&&Math.sign(u)!==this.lean&&(C=-u),m=Ie(C,f,m_),m=this.lean*tn(Math.abs(m),__,x_)}let y=(t+n)*.5,p=(e+s)*.5,g=tn((y/o.hl+1)*.5,.11,.89),S=tn(p*(a?.55:.28),-o.R*.5,o.R*.5);for(let C=0;C<this.scores.length;C++){let D=g-this.scores[C].t;Math.abs(D)<.075&&(g=tn(this.scores[C].t+(D>=0?.075:-.075),.11,.89))}let b=d/Math.max(1e-4,o.hl),v=tn((b-.12)/(.6-.12),0,1),w=(r||.3)/Math.max(.06,b),T=tn(.66+.3*w,.62,1.32),_=o.R*.78/Math.max(.18,Math.abs(Math.sin(m)));Ie(.14,.3,v)*o.hl>_&&(v=tn((_/o.hl-.14)/.16,0,1));let P={t:g,off:S,angle:m,len:v,depth:T,openStart:.13+this.scores.length*.052,seed:this.rnd()*1e6|0,popped:!1,settle:0,raw:{t:tn((y/o.hl+1)*.5,.02,.98),off:tn(p,-o.R,o.R),angle:u,half:d*.5}};return this.scores.push(P),P}scoreOpen(t){let e=this.bake;if(e<=.001)return 0;let n=S_(Go(e,t.openStart,t.openStart+.4));return n=n*.82+Zi(Go(e,.46,1))*.18,tn(n,0,1)}consumePops(){let t=[];for(let e of this.scores)!e.popped&&this.scoreOpen(e)>.16&&(e.popped=!0,t.push(e));return t}update(t){let e=!1;for(let n of this.scores)n.settle<1&&(n.settle=Math.min(1,n.settle+t*5),e=!0);return e}_geomOf(t,e){let n=Zi(t.settle),s=Ie(t.raw.t,t.t,n),r=Ie(t.raw.off,t.off,n),a=Ie(t.raw.angle,t.angle,n),o=Ie(Math.max(.008,t.raw.half),Ie(.14,.3,t.len)*e.hl,n);return{cx:(s*2-1)*e.hl,cy:r,ang:a,half:o}}surfaceFromLocal(t){let e=this.dims(),n=Math.atan2(t.z,t.y);return{sx:t.x,sy:n*e.R}}rebuild(){let t=this.dims(),e=this.nu,n=this.nv,s=this.cols,r=this.geometry.attributes.position.array,a=this.geometry.attributes.normal.array,o=this.geometry.attributes.aCrumb.array,l=this.geometry.attributes.aAO.array,c=[];for(let y of this.scores){let p=this._geomOf(y,t),g=this.scoreOpen(y),S=y.depth,b=t.R*(.058+.205*g*S),v=t.R*(.15+.31*g)*S,w=t.R*(.15+.195*g)*S,T=t.R*(.1+.08*g)*S,R=v_*g*S,_=w*Math.sin(R)*.92,E=nd(y.seed),P=[];for(let D=0;D<9;D++)P.push(E()*2-1);let C=[[-(b+w),0],[-(b+w*.8),_*.16],[-(b+w*.58),_*.42],[-(b+w*.36),_*.7],[-(b+w*.16),_*.9],[-(b+w*.02),_*.98],[-b*.86,_*.72],[-b*.64,_*.28],[-b*.44,-v*.24],[-b*.2,-v*.68],[b*.12,-v*.96],[b*.56,-v*.7],[b*.9,-v*.2],[b+T*.45,_*.16+t.R*.01],[b+T,0]];c.push({cx:p.cx,cy:p.cy,half:p.half,ca:Math.cos(p.ang),sa:Math.sin(p.ang),gh:b,cut:v,earW:w,lipW:T,phi:R,op:g,prof:C,b0:C[0][0],b1:C[C.length-1][0],nseg:C.length-1,outer:b+w+.004,jag:P})}let h=t.logness,d=1/Math.max(1e-4,t.R);for(let y=0;y<=e;y++){let p=-1+2*y/e,g=Math.sign(p)*Math.pow(Math.abs(p),.86),S=g*t.hl,b=this._prof(g,h),v=(g+1)*4,w=this.wob[Math.floor(v)%10],T=this.wob[(Math.floor(v)+1)%10],R=1+Ie(w,T,Zi(v-Math.floor(v)))*.03,_=t.R*b*R;for(let E=0;E<s;E++){let P=(E/n-.5)*Math.PI*2,C=_*this._sect(P),D=P*t.R,W=0,X=0,O=0,H=0,V=1;for(let ct=0;ct<c.length;ct++){let it=c[ct],zt=S-it.cx,$t=D-it.cy;if(Math.abs(zt)>it.half+it.outer+.02)continue;let Zt=zt*it.ca+$t*it.sa;if(Math.abs(Zt)>it.half)continue;let Z=-zt*it.sa+$t*it.ca;if(Math.abs(Z)>it.outer+it.lipW)continue;let at=Zt/it.half,tt=(at+1)*4,pt=Math.floor(tt),Ft=tt-pt,Pt=it.jag[(pt%9+9)%9],ne=it.jag[((pt+1)%9+9)%9],kt=Pt+(ne-Pt)*(Ft*Ft*(3-2*Ft)),j=Math.pow(Math.max(0,1-at*at),.55)*(1+kt*.055);if(j<=.001)continue;let rt=it.gh*(1+kt*.07),st=it.b0*(1+kt*.05),mt=it.b1*(1+kt*.05);if(Z<st||Z>mt)continue;let ut=(Z-st)/(mt-st),Ot=ut*it.nseg,Rt=Math.floor(Ot);Rt>it.nseg-1&&(Rt=it.nseg-1),Rt<0&&(Rt=0);let Vt=Ot-Rt,Xt=Vt*Vt*(3-2*Vt),L=it.prof[Rt],ue=it.prof[Rt+1],te=L[0]+(ue[0]-L[0])*Xt,A=L[1]+(ue[1]-L[1])*Xt;X+=(te-Z)*j,W+=A*j;let x=Ho(.48,.58,ut)*(1-Ho(.8,.9,ut)),F=j*x;F>H&&(H=F),V=Math.min(V,1-(.52*F+.28*j*Ho(.38,.5,ut)*(1-Ho(.58,.74,ut)))*(.35+.65*it.op))}let K=P+X*d,et=Math.max(6e-4,C+W),ot=y*s+E;r[ot*3]=S+O,r[ot*3+1]=et*Math.cos(K),r[ot*3+2]=et*Math.sin(K),o[ot]=H,l[ot]=V}}this.geometry.computeVertexNormals(),this.geometry.attributes.position.needsUpdate=!0,this.geometry.attributes.aCrumb.needsUpdate=!0,this.geometry.attributes.aAO.needsUpdate=!0,this.geometry.boundingSphere.radius=t.hl*1.15+t.R*2;let u=this.material.userData.uniforms,f=id(b_,this.bake),m=id(T_,this.bake);u.uCrust.value.setRGB(f[0],f[1],f[2],Se),u.uCrumb.value.setRGB(m[0],m[1],m[2],Se),u.uBake.value=this.bake,u.uFlour.value=Ie(1,.38,Zi(this.bake)),this.material.roughness=Ie(.9,.62,Zi(this.bake))}dispose(){this.geometry.dispose(),this.material.dispose()}};var Us=900;function A_(){let t=document.createElement("canvas");t.width=t.height=128;let e=t.getContext("2d"),n=e.createRadialGradient(128/2,128/2,0,128/2,128/2,128/2);n.addColorStop(0,"rgba(255,255,255,1)"),n.addColorStop(.35,"rgba(255,255,255,0.62)"),n.addColorStop(.72,"rgba(255,255,255,0.16)"),n.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=n,e.fillRect(0,0,128,128);let s=new yn(t);return s.colorSpace=Se,s}var Wo=class{constructor(t){let e=new Float32Array(Us*3),n=new Float32Array(Us*3),s=new Float32Array(Us),r=new Float32Array(Us),a=new Ue;a.setAttribute("position",new ye(e,3)),a.setAttribute("aColor",new ye(n,3)),a.setAttribute("aSize",new ye(s,1)),a.setAttribute("aAlpha",new ye(r,1)),a.setDrawRange(0,0),a.boundingSphere=new An(new I(0,1,-1),12);let o=new sn({uniforms:{uMap:{value:A_()},uPixelRatio:{value:1}},vertexShader:`
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aAlpha;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = aColor;
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * 1200.0 / max(0.05, -mv.z);
        }`,fragmentShader:`
        uniform sampler2D uMap;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 t = texture2D(uMap, gl_PointCoord);
          float a = t.a * vAlpha;
          if (a < 0.004) discard;
          gl_FragColor = vec4(vColor, a);
          #include <colorspace_fragment>
        }`,transparent:!0,depthWrite:!1,depthTest:!0,blending:jn});this.points=new nr(a,o),this.points.frustumCulled=!1,this.points.renderOrder=5,t.add(this.points),this.geo=a,this.list=[]}_push(t){this.list.length>=Us&&this.list.shift(),this.list.push(t)}steam(t,e,n,s=1,r=1,a=1){for(let o=0;o<s;o++)this._push({k:"s",x:t+le(-.05,.05)*r,y:e+le(-.02,.03)*r,z:n+le(-.05,.05)*r,vx:le(-.09,.09)*a,vy:le(.16,.42)*a,vz:le(-.07,.07)*a,size:le(.05,.11)*r,grow:le(.1,.24)*r,life:0,max:le(1.3,2.6),a:le(.24,.5),c:[.98,.97,.95]})}flour(t,e,n,s=1,r=1){for(let a=0;a<s;a++)this._push({k:"f",x:t+le(-.03,.03),y:e+le(-.01,.02),z:n+le(-.03,.03),vx:le(-.22,.22)*r,vy:le(.1,.45)*r,vz:le(-.22,.22)*r,size:le(.006,.02)*r,grow:le(.004,.014),life:0,max:le(.7,1.5),a:le(.35,.8),c:[1,.99,.96],g:-.55})}crumb(t,e,n,s=1){for(let r=0;r<s;r++)this._push({k:"c",x:t,y:e,z:n,vx:le(-.5,.5),vy:le(.3,.9),vz:le(-.5,.5),size:le(.0025,.006),grow:0,life:0,max:le(.6,1.1),a:1,c:[.8,.62,.36],g:-2.6})}spark(t,e,n,s=1,r=1){for(let a=0;a<s;a++)this._push({k:"k",x:t+le(-.02,.02),y:e+le(-.01,.02),z:n+le(-.02,.02),vx:le(-.2,.2),vy:le(.25,.75),vz:le(-.2,.2),size:le(.004,.011),grow:0,life:0,max:le(.5,1),a:1,c:r?[1,.72,.3]:[1,.95,.75],g:-.5})}update(t){let e=this.list;for(let l=e.length-1;l>=0;l--){let c=e[l];if(c.life+=t,c.life>=c.max){e.splice(l,1);continue}c.x+=c.vx*t,c.y+=c.vy*t,c.z+=c.vz*t,c.k==="s"?(c.vy+=.16*t,c.vx*=.985,c.vz*=.985,c.size+=c.grow*t):(c.vy+=(c.g||-1)*t,c.size+=(c.grow||0)*t)}let n=Math.min(e.length,Us),s=this.geo.attributes.position.array,r=this.geo.attributes.aColor.array,a=this.geo.attributes.aSize.array,o=this.geo.attributes.aAlpha.array;for(let l=0;l<n;l++){let c=e[l],h=c.life/c.max;s[l*3]=c.x,s[l*3+1]=c.y,s[l*3+2]=c.z,r[l*3]=c.c[0],r[l*3+1]=c.c[1],r[l*3+2]=c.c[2],a[l]=c.size,o[l]=c.k==="s"?c.a*Math.sin(Math.min(1,h*1.25)*Math.PI)*.95:c.a*(1-h)}this.geo.setDrawRange(0,n),this.geo.attributes.position.needsUpdate=!0,this.geo.attributes.aColor.needsUpdate=!0,this.geo.attributes.aSize.needsUpdate=!0,this.geo.attributes.aAlpha.needsUpdate=!0}clear(){this.list.length=0,this.geo.setDrawRange(0,0)}};function le(i,t){return i+Math.random()*(t-i)}var Xn=Math.PI*2,rd=(i,t,e)=>i<t?t:i>e?e:i,Uc=i=>(i=rd(i,0,1),i*i*(3-2*i)),Fc=(i,t,e)=>rd((i-t)/(e-t),0,1);function Ki(i,t,e,n,s,r){r=Math.min(r,n*.5,s*.5),i.beginPath(),i.moveTo(t+r,e),i.arcTo(t+n,e,t+n,e+s,r),i.arcTo(t+n,e+s,t,e+s,r),i.arcTo(t,e+s,t,e,r),i.arcTo(t,e,t+n,e,r),i.closePath()}function Oc(i,t,e,n,s,r,a){i.beginPath();for(let o=0;o<r*2;o++){let l=a+o*Math.PI/r,c=o%2?s:n,h=t+Math.cos(l)*c,d=e+Math.sin(l)*c;o===0?i.moveTo(h,d):i.lineTo(h,d)}i.closePath()}var he={};he.button=function(i,t,e){if(t.hidden)return;let n=t.pulse?1+Math.sin(e*3.4)*.05:1,s=t.r*n*(t.press?.93:1);if(i.save(),i.translate(t.x,t.y),t.pulse){let o=e*.9%1;i.strokeStyle=`rgba(255,255,255,${(.4*(1-o)).toFixed(3)})`,i.lineWidth=Math.max(3,s*.07),i.beginPath(),i.arc(0,0,s*(1+o*.3),0,Xn),i.stroke()}i.fillStyle="rgba(30,16,6,0.34)",i.beginPath(),i.arc(0,s*.12,s*1.02,0,Xn),i.fill();let r=i.createLinearGradient(0,-s,0,s),a=t.color||["#fdf3e2","#efd9b8"];r.addColorStop(0,a[0]),r.addColorStop(1,a[1]),i.fillStyle=r,i.beginPath(),i.arc(0,0,s,0,Xn),i.fill(),i.strokeStyle=t.ring||"rgba(198,120,70,0.9)",i.lineWidth=Math.max(3,s*.085),i.beginPath(),i.arc(0,0,s*.96,0,Xn),i.stroke(),i.save(),i.scale(s/50,s/50),he.icon(i,t.icon,e,t),i.restore(),i.restore()};he.hit=function(i,t,e,n){return!i||i.hidden?!1:Math.hypot(i.x-t,i.y-e)<=i.r*(i.hitScale||1.4)+(n||0)};function Fs(i,t,e,n){let s=i.createLinearGradient(0,-e,0,e);s.addColorStop(0,"#e7c58c"),s.addColorStop(.45,"#cd9a52"),s.addColorStop(1,"#9d6a30"),i.fillStyle=s,i.beginPath();for(let r=0;r<=40;r++){let a=-1+r/20,o=Math.pow(Math.max(0,1-Math.pow(Math.abs(a),5)),.28);i.lineTo(a*t,-e*o)}for(let r=40;r>=0;r--){let a=-1+r/20,o=Math.pow(Math.max(0,1-Math.pow(Math.abs(a),5)),.28);i.lineTo(a*t,e*o)}i.closePath(),i.fill(),i.strokeStyle="#f7e6c2",i.lineWidth=e*.42,i.lineCap="round";for(let r=0;r<n;r++){let a=-t*.56+t*1.12*r/Math.max(1,n-1);i.beginPath(),i.moveTo(a-t*.11,e*.42),i.lineTo(a+t*.11,-e*.42),i.stroke()}}function sd(i,t){i.save(),i.scale(t,t),i.rotate(.55);let e=i.createLinearGradient(-8,0,8,0);e.addColorStop(0,"#8f5f2e"),e.addColorStop(.45,"#c9903f"),e.addColorStop(1,"#7d5228"),i.fillStyle=e,Ki(i,-8,-6,16,52,8),i.fill(),i.fillStyle="#c8ced4",Ki(i,-7,-12,14,8,3),i.fill(),i.beginPath(),i.moveTo(-5,-12),i.quadraticCurveTo(-2,-34,1,-42),i.quadraticCurveTo(5,-32,5,-12),i.closePath();let n=i.createLinearGradient(-5,-40,6,-12);n.addColorStop(0,"#ffffff"),n.addColorStop(.55,"#d5dce3"),n.addColorStop(1,"#98a4ae"),i.fillStyle=n,i.fill(),i.restore()}he.icon=function(i,t,e,n){switch(i.lineCap="round",i.lineJoin="round",t){case"home":i.fillStyle="#b45c42",i.beginPath(),i.moveTo(0,-26),i.lineTo(28,0),i.lineTo(20,0),i.lineTo(20,26),i.lineTo(-20,26),i.lineTo(-20,0),i.lineTo(-28,0),i.closePath(),i.fill(),i.fillStyle="#fff4e4",Ki(i,-8,6,16,20,3),i.fill();break;case"sound":case"mute":i.fillStyle="#b45c42",i.beginPath(),i.moveTo(-20,-8),i.lineTo(-8,-8),i.lineTo(4,-22),i.lineTo(4,22),i.lineTo(-8,8),i.lineTo(-20,8),i.closePath(),i.fill(),i.strokeStyle="#b45c42",i.lineWidth=5,t==="sound"?(i.beginPath(),i.arc(6,0,13,-.9,.9),i.stroke(),i.beginPath(),i.arc(6,0,22,-.9,.9),i.stroke()):(i.beginPath(),i.moveTo(12,-12),i.lineTo(28,12),i.moveTo(28,-12),i.lineTo(12,12),i.stroke());break;case"arrowR":{let s=Math.sin(e*4)*3;i.fillStyle="#d96f2f",i.save(),i.translate(s,0),i.beginPath(),i.moveTo(-18,-10),i.lineTo(6,-10),i.lineTo(6,-22),i.lineTo(28,0),i.lineTo(6,22),i.lineTo(6,10),i.lineTo(-18,10),i.closePath(),i.fill(),i.restore();break}case"oven":{i.fillStyle="#6d4a38",Ki(i,-28,-26,56,52,7),i.fill();let s=i.createRadialGradient(0,8,2,0,8,26);s.addColorStop(0,"#ffd071"),s.addColorStop(.6,"#f08a24"),s.addColorStop(1,"#c9540f"),i.fillStyle=s,Ki(i,-20,-12,40,32,5),i.fill(),i.fillStyle="#4e352a",Ki(i,-23,-24,46,9,4),i.fill();break}case"steam":{i.strokeStyle="#7cb3d6",i.lineWidth=7;for(let s=-1;s<=1;s++){i.beginPath();let r=e*2.6+s;for(let a=0;a<=10;a++){let o=22-a*4.6,l=s*15+Math.sin(r+a*.7)*5;a===0?i.moveTo(l,o):i.lineTo(l,o)}i.stroke()}break}case"baguette":Fs(i,34,8,4);break;case"petite":Fs(i,23,6,3);break;case"batard":Fs(i,22,13,3);break;case"three":{i.save(),i.translate(-2,-17),i.rotate(-.1),i.scale(.62,.62),Fs(i,23,6,3),i.restore(),i.save(),i.translate(0,2),i.rotate(.04),i.scale(.62,.62),Fs(i,34,8,4),i.restore(),i.save(),i.translate(2,21),i.rotate(.14),i.scale(.62,.62),Fs(i,22,13,3),i.restore();break}case"lame":sd(i,.62);break;case"sparkleLame":{i.save(),i.translate(-5,3),sd(i,.55),i.restore(),i.fillStyle="#ffd24d",Oc(i,21,-17,12,5,4,e*2),i.fill(),Oc(i,-20,-23,7,3,4,-e*2),i.fill();break}}n&&n.badge&&he.badge(i,n.badge)};he.badge=function(i,t){i.save(),i.translate(31,-31),i.fillStyle="#d94f45",i.beginPath(),i.arc(0,0,15,0,Xn),i.fill(),i.fillStyle="#fff";for(let e=0;e<t;e++){let n=-Math.PI/2+(e-(t-1)/2)*.9;i.beginPath(),i.arc(Math.cos(n)*7,Math.sin(n)*7+3,3,0,Xn),i.fill()}i.restore()};he.hand=function(i,t,e,n,s,r){i.save(),i.translate(t,e),i.rotate(s||0),i.scale(n,n),i.globalAlpha=r===void 0?1:r,i.fillStyle="#ffe7d2",i.strokeStyle="rgba(120,74,44,0.6)",i.lineWidth=3,i.beginPath(),i.moveTo(-14,40),i.quadraticCurveTo(-22,16,-16,2),i.quadraticCurveTo(-12,-6,-6,-2),i.lineTo(-6,-26),i.quadraticCurveTo(-6,-34,0,-34),i.quadraticCurveTo(6,-34,6,-26),i.lineTo(6,-4),i.quadraticCurveTo(14,-8,18,0),i.quadraticCurveTo(24,14,20,40),i.closePath(),i.fill(),i.stroke(),i.restore()};he.hintTap=function(i,t,e,n,s){let r=n*1.15%1;i.save(),i.translate(t,e),i.strokeStyle=`rgba(255,255,255,${(.8*(1-r)).toFixed(3)})`,i.lineWidth=5*s,i.beginPath(),i.arc(0,0,(18+r*44)*s,0,Xn),i.stroke(),i.strokeStyle=`rgba(226,120,70,${(.6*(1-r)).toFixed(3)})`,i.beginPath(),i.arc(0,0,(12+r*30)*s,0,Xn),i.stroke();let a=Math.sin(n*3.6)*.5+.5;he.hand(i,6*s,(16+a*8)*s,.72*s,.15,.9),i.restore()};he.hintSwipe=function(i,t,e,n,s,r,a){let o=r*.62%1,l=Uc(Fc(o,.06,.86)),c=t+(n-t)*l,h=e+(s-e)*l,d=Math.atan2(s-e,n-t);i.save(),i.setLineDash([12*a,10*a]),i.lineDashOffset=-r*40*a,i.strokeStyle="rgba(255,255,255,0.78)",i.lineWidth=7*a,i.lineCap="round",i.beginPath(),i.moveTo(t,e),i.lineTo(n,s),i.stroke(),i.setLineDash([]),i.save(),i.translate(n,s),i.rotate(d),i.fillStyle="rgba(255,255,255,0.9)",i.beginPath(),i.moveTo(2*a,0),i.lineTo(-16*a,-12*a),i.lineTo(-11*a,0),i.lineTo(-16*a,12*a),i.closePath(),i.fill(),i.restore();let u=Uc(Fc(o,0,.1))*(1-Uc(Fc(o,.88,1)));he.hand(i,c,h+10*a,.78*a,.12,.9*u),i.restore()};he.steps=function(i,t,e,n,s){let r=Math.max(4,Math.min(t,e)*.0082),a=r*3,o=a*(s-1),l=t/2-o/2,c=e-Math.max(16,e*.024);i.save(),i.fillStyle="rgba(24,14,6,0.36)",Ki(i,l-r*2.4,c-r*2.2,o+r*4.8,r*4.4,r*2.2),i.fill();for(let h=0;h<s;h++){let d=l+a*h;i.fillStyle=h<=n?"rgba(246,182,102,0.98)":"rgba(255,244,226,0.28)",i.beginPath(),i.arc(d,c,h===n?r*1.5:r,0,Xn),i.fill(),h===n&&(i.strokeStyle="rgba(255,255,255,0.95)",i.lineWidth=Math.max(2,r*.4),i.beginPath(),i.arc(d,c,r*1.5,0,Xn),i.stroke())}i.restore()};he.trail=function(i,t,e){if(!t||t.length<2)return;i.save(),i.lineCap="round",i.lineJoin="round";let n=e*.012;i.strokeStyle="rgba(255,255,255,0.45)",i.lineWidth=n*2,i.beginPath(),t.forEach((s,r)=>r?i.lineTo(s.x,s.y):i.moveTo(s.x,s.y)),i.stroke(),i.strokeStyle="rgba(255,238,196,0.95)",i.lineWidth=n*.8,i.stroke(),i.restore()};he.celebrate=function(i,t,e,n){i.save();for(let s=0;s<26;s++){let r=(s*9301+49297)%233280/233280,a=(s*4021+7919)%104729/104729,o=r*t,l=(n*130*(.5+a)+a*e)%(e+60)-30,c=5+a*9,h=[38,24,44,12,50][s%5];i.fillStyle=`hsla(${h},92%,72%,0.9)`,Oc(i,o,l,c,c*.42,5,n*2+s),i.fill()}i.restore()};var ad=(i,t,e)=>i<t?t:i>e?e:i,J={ctx:null,master:null,enabled:!0,ready:!1,_noiseBuf:null,_frictionNode:null};function od(){if(J.ctx)return J.ctx;let i=window.AudioContext||window.webkitAudioContext;return i?(J.ctx=new i,J.master=J.ctx.createGain(),J.master.gain.value=.85,J.master.connect(J.ctx.destination),J._noiseBuf=R_(J.ctx,2),J.ready=!0,J.ctx):null}function R_(i,t){let e=i.sampleRate*t|0,n=i.createBuffer(1,e,i.sampleRate),s=n.getChannelData(0),r=0;for(let a=0;a<e;a++){let o=Math.random()*2-1;r=(r+.02*o)/1.02,s[a]=o*.7+r*3}return n}J.unlock=function(){let i=od();if(!i)return;i.state==="suspended"&&i.resume();let t=i.createOscillator(),e=i.createGain();e.gain.value=1e-4,t.connect(e),e.connect(J.master),t.start(),t.stop(i.currentTime+.03)};J.setEnabled=function(i){J.enabled=i,J.master&&(J.master.gain.value=i?.85:0)};function We(){return J.ctx.currentTime}function Pi(i,t){let e=J.ctx.createBufferSource();return e.buffer=J._noiseBuf,e.loop=!0,t&&(e.playbackRate.value=t),e.start(0,Math.random()*1.2),e.stop(We()+i+.05),e}function en(i,t,e,n,s,r){i.gain.cancelScheduledValues(t),i.gain.setValueAtTime(1e-4,t),i.gain.linearRampToValueAtTime(s,t+e),i.gain.exponentialRampToValueAtTime(1e-4,t+e+n+(r||0))}function cn(){return!J.enabled||(J.ctx||od(),!J.ctx)?!1:(J.ctx.state==="suspended"&&J.ctx.resume(),!0)}J.pof=function(i){if(!cn())return;let t=We(),e=i===void 0?1:i,n=J.ctx.createOscillator();n.type="sine",n.frequency.setValueAtTime(160,t),n.frequency.exponentialRampToValueAtTime(48,t+.18);let s=J.ctx.createGain();en(s,t,.005,.2,.42*e),n.connect(s),s.connect(J.master),n.start(t),n.stop(t+.32);let r=Pi(.3),a=J.ctx.createBiquadFilter();a.type="lowpass",a.frequency.setValueAtTime(1400,t),a.frequency.exponentialRampToValueAtTime(320,t+.22);let o=J.ctx.createGain();en(o,t,.006,.2,.2*e),r.connect(a),a.connect(o),o.connect(J.master)};J.press=function(i){if(!cn())return;let t=We(),e=J.ctx.createOscillator();e.type="sine";let n=300*(i||1);e.frequency.setValueAtTime(n,t),e.frequency.exponentialRampToValueAtTime(n*.45,t+.12);let s=J.ctx.createGain();en(s,t,.004,.11,.18),e.connect(s),s.connect(J.master),e.start(t),e.stop(t+.2);let r=Pi(.16),a=J.ctx.createBiquadFilter();a.type="bandpass",a.frequency.value=900,a.Q.value=.9;let o=J.ctx.createGain();en(o,t,.004,.1,.1),r.connect(a),a.connect(o),o.connect(J.master)};J.frictionStart=function(){if(!cn()||J._frictionNode)return;let i=J.ctx.createBufferSource();i.buffer=J._noiseBuf,i.loop=!0;let t=J.ctx.createBiquadFilter();t.type="lowpass",t.frequency.value=700,t.Q.value=.6;let e=J.ctx.createBiquadFilter();e.type="highpass",e.frequency.value=140;let n=J.ctx.createGain();n.gain.value=1e-4,i.connect(t),t.connect(e),e.connect(n),n.connect(J.master),i.start(0,Math.random()),J._frictionNode={src:i,gain:n,filt:t}};J.frictionLevel=function(i){let t=J._frictionNode;if(!t||!J.ctx)return;let e=We(),n=ad(i,0,1);t.gain.gain.setTargetAtTime(1e-4+n*.16,e,.05),t.filt.frequency.setTargetAtTime(420+n*1500,e,.06)};J.frictionStop=function(){let i=J._frictionNode;if(!i)return;let t=We();i.gain.gain.setTargetAtTime(1e-4,t,.06);try{i.src.stop(t+.5)}catch{}J._frictionNode=null};J.slash=function(i){if(!cn())return;let t=We(),e=ad(i===void 0?.6:i,.2,1.4),n=Pi(.3),s=J.ctx.createBiquadFilter();s.type="bandpass",s.Q.value=1.1,s.frequency.setValueAtTime(4200*e,t),s.frequency.exponentialRampToValueAtTime(900,t+.16);let r=J.ctx.createGain();en(r,t,.008,.14,.3),n.connect(s),s.connect(r),r.connect(J.master);let a=J.ctx.createOscillator();a.type="triangle",a.frequency.setValueAtTime(1500*e,t),a.frequency.exponentialRampToValueAtTime(520,t+.13);let o=J.ctx.createGain();en(o,t,.006,.1,.055),a.connect(o),o.connect(J.master),a.start(t),a.stop(t+.2)};J.steam=function(i){if(!cn())return;let t=We(),e=i||1.8,n=Pi(e+.4),s=J.ctx.createBiquadFilter();s.type="bandpass",s.Q.value=.65,s.frequency.setValueAtTime(500,t),s.frequency.exponentialRampToValueAtTime(3600,t+.22),s.frequency.exponentialRampToValueAtTime(700,t+e);let r=J.ctx.createGain();r.gain.setValueAtTime(1e-4,t),r.gain.linearRampToValueAtTime(.34,t+.14),r.gain.setValueAtTime(.34,t+.4),r.gain.exponentialRampToValueAtTime(1e-4,t+e),n.connect(s),s.connect(r),r.connect(J.master)};J.crackle=function(i){if(!cn())return;let t=We()+Math.random()*.02,e=Pi(.06),n=J.ctx.createBiquadFilter();n.type="highpass",n.frequency.value=2600+Math.random()*2600;let s=J.ctx.createGain();en(s,t,.001,.035,(.05+Math.random()*.07)*(i||1)),e.connect(n),n.connect(s),s.connect(J.master)};J.knock=function(){if(!cn())return;let i=We();[0,.155].forEach((t,e)=>{let n=i+t,s=Pi(.1),r=J.ctx.createBiquadFilter();r.type="bandpass",r.frequency.value=1900,r.Q.value=.8;let a=J.ctx.createGain();en(a,n,.001,.05,.2),s.connect(r),r.connect(a),a.connect(J.master),[[196,.16],[430,.1],[880,.05]].forEach(([o,l])=>{let c=J.ctx.createOscillator();c.type="sine",c.frequency.setValueAtTime(o*(e?1.04:1),n),c.frequency.exponentialRampToValueAtTime(o*.9,n+.18);let h=J.ctx.createGain();en(h,n,.002,.16,l),c.connect(h),h.connect(J.master),c.start(n),c.stop(n+.3)})})};J.swell=function(i){if(!cn())return;let t=We(),e=i||3.2,n=J.ctx.createOscillator();n.type="sine",n.frequency.setValueAtTime(70,t),n.frequency.linearRampToValueAtTime(112,t+e);let s=J.ctx.createGain();s.gain.setValueAtTime(1e-4,t),s.gain.linearRampToValueAtTime(.11,t+e*.45),s.gain.exponentialRampToValueAtTime(1e-4,t+e),n.connect(s),s.connect(J.master),n.start(t),n.stop(t+e+.1)};J.pop=function(i){if(!cn())return;let t=We(),e=J.ctx.createOscillator();e.type="sine";let n=380*(i||1);e.frequency.setValueAtTime(n*.6,t),e.frequency.exponentialRampToValueAtTime(n*1.5,t+.09);let s=J.ctx.createGain();en(s,t,.004,.13,.1),e.connect(s),s.connect(J.master),e.start(t),e.stop(t+.22)};J.chime=function(i){if(!cn())return;let t=We();(i==="big"?[523.25,659.25,783.99,1046.5]:[659.25,987.77]).forEach((n,s)=>{let r=t+s*.085,a=J.ctx.createOscillator();a.type="sine",a.frequency.value=n;let o=J.ctx.createOscillator();o.type="sine",o.frequency.value=n*2.01;let l=J.ctx.createGain(),c=J.ctx.createGain();en(l,r,.006,.42,.1),en(c,r,.006,.24,.03),a.connect(l),l.connect(J.master),o.connect(c),c.connect(J.master),a.start(r),a.stop(r+.7),o.start(r),o.stop(r+.5)})};J.tapUI=function(){if(!cn())return;let i=We(),t=J.ctx.createOscillator();t.type="triangle",t.frequency.setValueAtTime(760,i),t.frequency.exponentialRampToValueAtTime(1180,i+.07);let e=J.ctx.createGain();en(e,i,.004,.1,.075),t.connect(e),e.connect(J.master),t.start(i),t.stop(i+.18)};J.cloth=function(){if(!cn())return;let i=We(),t=Pi(.4),e=J.ctx.createBiquadFilter();e.type="bandpass",e.frequency.setValueAtTime(2400,i),e.Q.value=.5,e.frequency.exponentialRampToValueAtTime(900,i+.3);let n=J.ctx.createGain();en(n,i,.02,.26,.12),t.connect(e),e.connect(n),n.connect(J.master)};J.door=function(i){if(!cn())return;let t=We(),e=J.ctx.createOscillator();e.type="sine",e.frequency.setValueAtTime(i?90:130,t),e.frequency.exponentialRampToValueAtTime(i?150:60,t+.25);let n=J.ctx.createGain();en(n,t,.01,.24,.22),e.connect(n),n.connect(J.master),e.start(t),e.stop(t+.4);let s=Pi(.3),r=J.ctx.createBiquadFilter();r.type="lowpass",r.frequency.value=900;let a=J.ctx.createGain();en(a,t,.01,.2,.09),s.connect(r),r.connect(a),a.connect(J.master)};J.ovenHum=function(i){if(cn()){if(i){if(J._hum)return;let t=J.ctx.createBufferSource();t.buffer=J._noiseBuf,t.loop=!0;let e=J.ctx.createBiquadFilter();e.type="lowpass",e.frequency.value=190,e.Q.value=1.2;let n=J.ctx.createGain();n.gain.value=1e-4,n.gain.setTargetAtTime(.075,We(),.6),t.connect(e),e.connect(n),n.connect(J.master),t.start(0,Math.random()),J._hum={src:t,gain:n}}else if(J._hum){let t=J._hum;t.gain.gain.setTargetAtTime(1e-4,We(),.4);try{t.src.stop(We()+1.6)}catch{}J._hum=null}}};var ae=J;var Ji=["place","press","roll","stretch","couche","proof","score","load","steam","bake","out","tap"],C_=12,ce=(i,t,e)=>i<t?t:i>e?e:i,oi=(i,t,e)=>i+(t-i)*e,ld=i=>(i=ce(i,0,1),i*i*(3-2*i)),Os=i=>(i=ce(i,0,1),i*i*i*(i*(i*6-15)+10)),P_=(i,t,e)=>ce((i-t)/(e-t),0,1),Le=(i,t)=>i+Math.random()*(t-i),Sn=(i,t,e,n)=>i+(t-i)*(1-Math.exp(-e*n)),re={bench:new I(0,wt.benchTop,.14),couche:new I(0,wt.benchTop+.004,-.17),couchePitch:.118,oven:new I(0,wt.deckY,wt.ovenFront-.6),rack:new I(0,wt.benchTop+.026,.1),peelWait:new I(0,wt.benchTop+.02,.3)};function pe(i,t,e,n,s,r,a){return{az:i*Math.PI/180,el:t*Math.PI/180,dist:e,target:new I(n,s,r),fov:a}}var Xo=wt.ovenFront-.6,I_={menu:pe(27,27,3.3,0,1.06,-1.45,44),place:pe(6,36,.9,0,.955,.13,40),press:pe(6,36,.86,0,.955,.13,40),roll:pe(4,34,.95,0,.95,.13,40),stretch:pe(3,33,1.1,0,.945,.1,40),couche:pe(7,32,1.16,0,.95,-.14,40),proof:pe(9,30,1.02,0,.952,-.16,38),score:pe(10,37,.8,0,.958,-.17,36),load:pe(5,20,1.95,0,1.02,-1.05,46),steam:pe(16,34,.84,0,1.008,Xo+.05,44),bake:pe(19,37,.7,0,1.01,Xo+.02,42),out:pe(7,22,1.85,0,1.01,-1.3,44),tap:pe(9,33,.92,0,.975,.1,38),done:pe(16,29,1.24,0,.985,.04,42)},L_={menu:pe(22,29,2.95,0,1.1,-1.35,56),place:pe(40,40,.72,0,.955,.13,52),press:pe(40,40,.7,0,.955,.13,52),roll:pe(42,38,.76,0,.95,.13,52),stretch:pe(46,36,.9,0,.945,.1,52),couche:pe(50,34,.98,0,.95,-.14,52),proof:pe(50,33,.9,0,.952,-.16,50),score:pe(53,39,.74,0,.958,-.17,48),load:pe(34,24,1.6,0,1.02,-1.05,56),steam:pe(42,35,.76,0,1.008,Xo+.05,56),bake:pe(46,38,.66,0,1.01,Xo+.02,54),out:pe(38,25,1.55,0,1.01,-1.25,54),tap:pe(46,35,.82,0,.975,.1,50),done:pe(46,31,1.08,0,.985,.04,52)},qo=class{constructor(t,e){this.stage3=new Vo(t),this.hudCanvas=e,this.hctx=e.getContext("2d"),this.scene=this.stage3.scene,this.camera=this.stage3.camera,this.raycaster=new vr,this.ndc=new ht,this.time=0,this.stageT=0,this.idleT=0,this.stage="menu",this.history=[],this.typeKey="normal",this.freeMode=!1,this.soundOn=!0,this.loaves=[],this.buttons={},this.trail=[],this.parallax=new ht,this._buildWorld(),this._resetCounters(),this.camCur={az:0,el:0,dist:2,target:new I,fov:40},this._applyCamTarget(!0),this._bindInput(t.parentElement||document.body)}_buildWorld(){let t=this.scene;t.add(Wu()),t.add(Xu());let e=Yu();t.add(e.group),this.ovenDoor=e.doorPivot,t.add(Zu()),this.couche=qu(1.42,.66,3,re.couchePitch),this.couche.position.copy(re.couche),this.couche.position.y=wt.benchTop+.001,t.add(this.couche),this.lame=Ju(),this.lame.position.set(.58,wt.benchTop+.01,.3),this.lame.rotation.set(Math.PI/2,0,-.5),t.add(this.lame);let n=Qu();n.position.set(-.68,wt.benchTop+.001,.3),n.rotation.y=.35,t.add(n),this.dredger=ju(),this.dredger.position.set(-.9,wt.benchTop,.12),t.add(this.dredger);let s=td(.36,.34);s.position.set(.92,wt.benchTop-.1,.4),s.rotation.set(.12,-.25,.05),t.add(s),this.peel=$u(),this.peel.position.copy(re.peelWait),this.peel.visible=!1,t.add(this.peel),this.rack=Ku(),this.rack.position.set(re.rack.x,wt.benchTop+.001,re.rack.z),this.rack.visible=!1,t.add(this.rack);let r=new be,a=(l,c,h)=>{let d=new Ns(l,c,h);d.press=1,d.roll=1,d.stretch=1,d.proof=1;let u=d.dims().hl,f=l==="normal"?4:3;for(let m=0;m<f;m++){let y=(-.62+1.24*m/(f-1))*u;d.addScore(y-.055,-.008,y+.055,.008,.3,!1),d.scores[m].settle=1}return d.bake=.86+Math.random()*.12,d.cool=1,d.rebuild(),d.mesh.castShadow=!0,d.mesh.receiveShadow=!0,d.mesh};for(let l=0;l<3;l++){let c=1.2+l*.56;for(let h=0;h<3;h++){let d=a(h%3===2?"batard":"normal",5e3+l*41+h,{nu:44,nv:20});d.position.set(1.05+h*.6+l%2*.12,c+.055,-6+(h+l)%3*.045),d.rotation.set(.02,.06+h*.09,.05),r.add(d)}}let o=Nc(.16,.13);o.position.set(.86,wt.benchTop,-.34),o.rotation.y=.3,r.add(o);for(let l=0;l<3;l++){let c=a("normal",9100+l,{nu:72,nv:30});c.position.set(.86+(l-1)*.035,wt.benchTop+.05+l*.03,-.34+(l-1)*.03),c.rotation.set(0,.28+l*.06,.3+l*.05),r.add(c)}for(let l=0;l<3;l++){let c=Nc(.13,.1);c.position.set(-2.3+l*.55,1.62,-6.05),c.rotation.x=-.35,r.add(c)}t.add(r),this.loafGroup=new be,t.add(this.loafGroup),this.loaf=null,this.sibs=[],this.parts=new Wo(t),this.bubbleGroup=new be,this.loafGroup.add(this.bubbleGroup),this._plane=new vn,this._hit=new I}_resetCounters(){this.rollAcc=0,this.stretchAcc=0,this.pressCount=0,this.bakeT=0,this.slideK=0,this.steamK=0,this.knock=0,this.heat=0,this.doorK=0,this.crackleT=0,this.celebrateT=0,this.dropK=0,this.bubbles=[]}newLoaf(t){this.typeKey=t==="free"?"free":t,this.freeMode=t==="free",this.loaf&&(this.loafGroup.remove(this.loaf.mesh),this.loaf.dispose());for(let e of this.sibs)this.scene.remove(e.mesh),e.dispose();this.sibs=[],this.loaf=new Ns(this.typeKey),this.loafGroup.add(this.loaf.mesh),this._resetCounters(),this.setStage("place")}_makeSiblings(){for(let t of this.sibs)this.scene.remove(t.mesh),t.dispose();this.sibs=[];for(let t=0;t<2;t++){let e=new Ns(this.typeKey,void 0,{nu:120,nv:44});e.press=1,e.roll=1,e.stretch=1,e.proof=this.loaf.proof,e.rebuild(),e.mesh.castShadow=!0,e.side=t===0?-1:1,this.scene.add(e.mesh),this.sibs.push(e)}}_copyScoresToSiblings(){for(let t of this.sibs){t.scores.length=0,t.lean=this.loaf.lean;for(let e of this.loaf.scores){let n=Object.assign({},e);n.t=ce(e.t+Le(-.03,.03),.1,.9),n.off=e.off*.6+Le(-.003,.003),n.angle=e.angle+Le(-.05,.05),n.len=ce(e.len+Le(-.1,.1),0,1),n.depth=ce(e.depth+Le(-.08,.08),.6,1.35),n.seed=Math.random()*1e6|0,n.settle=1,n.popped=!1,n.raw={t:n.t,off:n.off,angle:n.angle,half:.05},t.scores.push(n)}t.rebuild()}}_syncSiblings(){for(let t of this.sibs)t.proof=this.loaf.proof,t.bake=this.loaf.bake,t.cool=this.loaf.cool}_placeLoaf(t){if(!this.loaf)return;let e=this.loaf.dims(),n=this.stage,s=this.loafGroup,r=new I,a=0,o=0;if(n==="menu")r.set(0,wt.benchTop+e.R,re.couche.z);else if(n==="place"||n==="press"||n==="roll"||n==="stretch")r.copy(re.bench),r.y+=e.R*(1-.1*this.loaf.press),n==="place"&&(r.y+=(1-Os(ce(this.dropK/.62,0,1)))*.42);else if(n==="couche"||n==="proof"||n==="score")r.copy(this.dragPos||re.couche),r.y=wt.benchTop+.006+e.R*.88;else if(n==="load"){let l=Os(this.slideK),c=new I(re.couche.x,wt.benchTop+.028+e.R*.9,re.peelWait.z-.1),h=new I(re.oven.x,wt.deckY+e.R*.92,re.oven.z);r.lerpVectors(c,h,l),r.y+=Math.sin(l*Math.PI)*.05}else if(n==="steam"||n==="bake")r.set(re.oven.x,wt.deckY+e.R*.92,re.oven.z);else if(n==="out"){let l=Os(this.slideK),c=new I(re.oven.x,wt.deckY+e.R*.92,re.oven.z),h=new I(re.rack.x,wt.benchTop+.03+e.R*.92,re.rack.z);r.lerpVectors(c,h,l),r.y+=Math.sin(l*Math.PI)*.1}else r.set(re.rack.x,wt.benchTop+.03+e.R*.92,re.rack.z);s.position.copy(r),s.rotation.set(o,a,0);for(let l of this.sibs){let c=l.dims();l.mesh.position.set(r.x,r.y+(c.R-e.R),r.z+l.side*re.couchePitch),l.mesh.rotation.copy(s.rotation),l.mesh.visible=["couche","proof","score","load","steam","bake","out","tap","done"].includes(n)}}_camTarget(){let t=this.portrait?L_:I_,e=this.stage;if(e==="load"||e==="out"){let n=Os(ce(this.slideK,0,1)),s=e==="load"?t.score:t.bake,r=e==="load"?t.bake:t.tap;this._blend||(this._blend={az:0,el:0,dist:1,target:new I,fov:40});let a=this._blend;return a.az=oi(s.az,r.az,n),a.el=oi(s.el,r.el,n),a.dist=oi(s.dist,r.dist,n),a.fov=oi(s.fov,r.fov,n),a.target.lerpVectors(s.target,r.target,n),a}return t[e]||t.score}_applyCamTarget(t){let e=this._camTarget(),n=this.camCur;t&&(n.az=e.az,n.el=e.el,n.dist=e.dist,n.target.copy(e.target),n.fov=e.fov)}_updateCamera(t){let e=this._camTarget(),n=this.camCur,s=3.2;n.az=Sn(n.az,e.az,s,t),n.el=Sn(n.el,e.el,s,t),n.dist=Sn(n.dist,e.dist,s,t),n.target.lerp(e.target,1-Math.exp(-s*t)),n.fov=Sn(n.fov,e.fov,s,t);let r=n.az+this.parallax.x*.055,a=ce(n.el+this.parallax.y*.035,.06,1.35),o=n.target.x+Math.sin(r)*Math.cos(a)*n.dist,l=n.target.y+Math.sin(a)*n.dist,c=n.target.z+Math.cos(r)*Math.cos(a)*n.dist;this.camera.position.set(o,l,c),this.camera.lookAt(n.target),Math.abs(this.camera.fov-n.fov)>.01&&(this.camera.fov=n.fov,this.camera.updateProjectionMatrix())}_bindInput(t){let e=this.hudCanvas;this.ptr={down:!1,id:null,x:0,y:0,px:0,py:0,sx:0,sy:0,st:0,moved:0,consumed:!1};let n=r=>{let a=e.getBoundingClientRect();return{x:r.clientX-a.left,y:r.clientY-a.top}};e.addEventListener("pointerdown",r=>{r.preventDefault();try{e.setPointerCapture(r.pointerId)}catch{}if(this.ptr.down)return;let a=n(r);Object.assign(this.ptr,{down:!0,id:r.pointerId,x:a.x,y:a.y,px:a.x,py:a.y,sx:a.x,sy:a.y,st:this.time,moved:0}),this.idleT=0,ae.unlock(),this._onDown(a.x,a.y)},{passive:!1}),e.addEventListener("pointermove",r=>{r.preventDefault();let a=n(r);this.parallax.set(ce((a.x/this.W-.5)*2,-1,1),ce((.5-a.y/this.H)*2,-1,1)),!(!this.ptr.down||r.pointerId!==this.ptr.id)&&(this.ptr.px=this.ptr.x,this.ptr.py=this.ptr.y,this.ptr.x=a.x,this.ptr.y=a.y,this.ptr.moved+=Math.hypot(a.x-this.ptr.px,a.y-this.ptr.py),this.idleT=0,this._onMove(a.x,a.y))},{passive:!1});let s=r=>{r.preventDefault(),this.ptr.down&&(this.ptr.down=!1,this.ptr.id=null,ae.frictionStop(),this._onUp(this.ptr.x,this.ptr.y))};e.addEventListener("pointerup",s,{passive:!1}),e.addEventListener("pointercancel",()=>{this.ptr.down=!1,ae.frictionStop()}),e.addEventListener("contextmenu",r=>r.preventDefault())}_ray(t,e){return this.ndc.set(t/this.W*2-1,-(e/this.H)*2+1),this.raycaster.setFromCamera(this.ndc,this.camera),this.raycaster}_hitPlane(t,e,n){this._plane.set(new I(0,1,0),-n);let r=this._ray(t,e).ray.intersectPlane(this._plane,this._hit);return r?r.clone():null}_hitLoafSurface(t,e){if(!this.loaf)return null;let n=this.loaf.dims(),s=this.loafGroup.position.y+n.R*.72,r=this._hitPlane(t,e,s);if(!r)return null;let a=r.x-this.loafGroup.position.x,o=r.z-this.loafGroup.position.z;return Math.abs(a)>n.hl*1.5+.06||Math.abs(o)>n.R+re.couchePitch*.72?null:{sx:a,sy:ce(o,-n.R*.85,n.R*.85),world:r}}_onDown(t,e){if(this._hudDown(t,e)){this.ptr.consumed=!0;return}this.ptr.consumed=!1;let n=this.stage;if(n==="place")this.dropK<=0&&(this.dropK=1e-4);else if(n==="press")this._doPress(t,e);else if(n==="roll"||n==="stretch")ae.frictionStart();else if(n==="score"){let s=this._hitLoafSurface(t,e);this.cutting=!!s,s&&(this.cutStart=s,this.trail=[{x:t,y:e}])}else if(n==="couche"){let s=this._hitPlane(t,e,this.loafGroup.position.y);s&&(this.dragOffset=new I().subVectors(this.loafGroup.position,s))}else n==="tap"&&this._doKnock(t,e)}_onMove(t,e){if(this.ptr.consumed)return;let n=this.stage,s=t-this.ptr.px,r=e-this.ptr.py;if(n==="roll"||n==="stretch"){let a=this.loafGroup.position.y,o=this._hitPlane(this.ptr.px,this.ptr.py,a),l=this._hitPlane(t,e,a);if(o&&l){let c=Math.abs(l.z-o.z),h=Math.abs(l.x-o.x),d=ce(Math.hypot(s,r)/22,0,1);ae.frictionLevel(d),n==="roll"?(this.rollAcc+=c,this.loaf.roll=ce(this.rollAcc/.46,0,1),Math.random()<.25&&this.parts.flour(l.x,a+.03,l.z,1,.8),this.loaf.roll>=1&&this._finish("roll")):(this.stretchAcc+=h,this.loaf.stretch=ce(this.stretchAcc/1.35,0,1),Math.random()<.3&&this.parts.flour(l.x,a+.02,l.z,1,.8),this.loaf.stretch>=1&&this._finish("stretch")),this.loaf.rebuild()}}else if(n==="couche"){let a=this._hitPlane(t,e,this.loafGroup.position.y);if(a&&this.dragOffset){let o=a.clone().add(this.dragOffset);this.dragPos=new I(ce(o.x,-.35,.35),0,ce(o.z,-.45,.45))}}else if(n==="score"&&this.cutting){let a=this.trail[this.trail.length-1];(!a||Math.hypot(a.x-t,a.y-e)>4)&&this.trail.push({x:t,y:e}),this.trail.length>90&&this.trail.shift()}else n==="load"&&this.slideK<=0&&this.ptr.moved>this.mn*.09?this._startLoad():n==="out"&&this.slideK<=0&&this.ptr.moved>this.mn*.08&&this._startOut()}_onUp(t,e){if(this.ptr.consumed){this._hudUp(t,e);return}let n=this.stage;n==="score"&&this.cutting?(this._finishCut(t,e),this.cutting=!1):n==="couche"?this._snapCouche():n==="load"&&this.slideK<=0?this._startLoad():n==="out"&&this.slideK<=0?this._startOut():n==="proof"&&this.loaf.proof>.9?this._advance():n==="roll"&&this.ptr.moved<6?(this.rollAcc+=.14,this.loaf.roll=ce(this.rollAcc/.46,0,1),this.loaf.rebuild(),ae.press(1.1),this.loaf.roll>=1&&this._finish("roll")):n==="stretch"&&this.ptr.moved<6&&(this.stretchAcc+=.34,this.loaf.stretch=ce(this.stretchAcc/1.35,0,1),this.loaf.rebuild(),ae.press(.9),this.loaf.stretch>=1&&this._finish("stretch"))}_doPress(t,e){let n=this._hitLoafSurface(t,e);if(!n)return;let s=-1,r=1e9;for(let a=0;a<this.bubbles.length;a++){let o=this.bubbles[a];if(o.pop>0)continue;let l=Math.hypot(o.sx-n.sx,o.sy-n.sy);l<r&&(r=l,s=a)}s>=0&&(this.bubbles[s].pop=1e-4),this.pressCount++,this.loaf.press=ce(this.pressCount/4,0,1),this.loaf.rebuild(),ae.press(.9+this.pressCount*.09),this.parts.flour(n.world.x,n.world.y+.01,n.world.z,8,1),this.pressCount>=4&&(ae.chime(),setTimeout(()=>{this.stage==="press"&&this._advance()},420))}_finish(t){this.stage===t&&(t==="roll"?this.loaf.roll=1:this.loaf.stretch=1,this.loaf.rebuild(),ae.chime(),ae.frictionStop(),setTimeout(()=>{this.stage===t&&this._advance()},400))}_snapCouche(){this.dragPos=null,ae.cloth(),this.parts.flour(re.couche.x,wt.benchTop+.05,re.couche.z,14,1.1),setTimeout(()=>{this.stage==="couche"&&(ae.chime(),this._advance())},460)}_finishCut(t,e){if(this.trail.length<2){this.trail=[];return}let n=this.trail[0],s=this.trail[this.trail.length-1],r=Math.hypot(s.x-n.x,s.y-n.y);if(r<this.mn*.035){this.trail=[];return}let a=this.cutStart,o=this._hitLoafSurface(t,e);if(this.trail=[],!a||!o)return;let l=this.time-this.ptr.st,c=this.loaf.addScore(a.sx,a.sy,o.sx,o.sy,l,this.freeMode);if(!c)return;this.loaf.rebuild(),ae.slash(ce(r/(this.mn*.35),.35,1.3));let h=this.loaf.dims(),d=oi(.14,.3,c.len)*h.hl;for(let f=0;f<=6;f++){let m=-1+2*f/6,y=(c.t*2-1)*h.hl+Math.cos(c.angle)*d*m,p=c.off+Math.sin(c.angle)*d*m;this.parts.flour(this.loafGroup.position.x+y,this.loafGroup.position.y+h.R*.9,this.loafGroup.position.z+p,2,.55)}let u=this.freeMode?8:5;this.loaf.scores.length>=u&&setTimeout(()=>{this.stage==="score"&&this._advance()},900)}_startLoad(){this.slideK>0||(this.slideK=1e-4,this.doorK=1,ae.door(!0))}_doSteam(){if(this.steamK>0)return;this.steamK=1e-4,ae.steam(2.2);let t=re.oven;for(let e=0;e<10;e++)setTimeout(()=>{for(let n=0;n<6;n++)this.parts.steam(t.x+Le(-.55,.55),wt.deckY+Le(0,.22),t.z+Le(-.35,.35),1,1.15,1.25)},e*85);setTimeout(()=>{this.stage==="steam"&&this._advance()},1500)}_startOut(){this.slideK>0||(this.slideK=1e-4,ae.door(!1))}_doKnock(t,e){let n=this._hitLoafSurface(t,e);if(n){this.knock++,ae.knock(),this.parts.crumb(n.world.x,n.world.y,n.world.z,10),this.parts.spark(n.world.x,n.world.y+.01,n.world.z,6,1);for(let s=0;s<5;s++)setTimeout(()=>ae.crackle(1.1),120+s*90);this.knock>=2&&setTimeout(()=>{this.stage==="tap"&&(ae.chime("big"),this.setStage("done"))},700)}}setStage(t){if(this.history.push(t+"@"+this.time.toFixed(2)),this.stage=t,this.stageT=0,this.idleT=0,this.trail=[],t==="press"){this.pressCount=0,this.bubbles=[];let e=this.loaf.dims();for(let n=0;n<4;n++)this.bubbles.push({sx:(-.55+1.1*n/3)*e.hl,sy:Le(-.4,.4)*e.R,r:Le(.01,.016),pop:0,mesh:null});this._syncBubbles()}t==="couche"&&this._makeSiblings(),t==="load"&&(this.slideK=0,this._copyScoresToSiblings(),this.peel.visible=!0),t==="steam"&&(this.steamK=0),t==="bake"&&(this.bakeT=0,ae.ovenHum(!0),ae.swell(4.2)),t==="out"&&(this.slideK=0,ae.ovenHum(!1),this.rack.visible=!0),t==="tap"&&(this.knock=0),t==="done"&&(this.celebrateT=0,this.loaf&&!this.loaves.includes(this.loaf)&&this.loaves.push(this.loaf)),t==="menu"&&ae.ovenHum(!1),this._applyCamTarget(t==="menu")}_advance(){let t=Ji.indexOf(this.stage);t>=0&&t<Ji.length-1?this.setStage(Ji[t+1]):this.setStage("done")}_syncBubbles(){for(;this.bubbleGroup.children.length;){let e=this.bubbleGroup.children.pop();e.geometry.dispose(),e.material.dispose(),this.bubbleGroup.remove(e)}let t=this.loaf.dims();for(let e of this.bubbles){let n=new Tt(new Rn(e.r,18,14),new Qt({color:15919830,roughness:.78,metalness:0,transparent:!0,opacity:.95}));n.position.set(e.sx,t.R*.62,e.sy),n.scale.set(1.25,.55,1.15),n.castShadow=!1,n.receiveShadow=!0,e.mesh=n,this.bubbleGroup.add(n)}}update(t){this.time+=t,this.stageT+=t,this.ptr.down||(this.idleT+=t);let e=this.stage;if(this.loaf&&this.loaf.update(t)&&this.loaf.rebuild(),this._syncSiblings(),e==="place"&&this.dropK>0&&this.dropK<1){let r=this.dropK;if(this.dropK=Math.min(1,this.dropK+t*2.2),r<.62&&this.dropK>=.62){ae.pof();let a=this.loafGroup.position;this.parts.flour(a.x,a.y,a.z,26,1.4)}this.dropK>=1&&setTimeout(()=>{this.stage==="place"&&this._advance()},300)}if(e==="press"){let r=this.loaf.dims();for(let a of this.bubbles)if(a.pop>0&&a.pop<1&&(a.pop=Math.min(1,a.pop+t*3.4)),a.mesh){let o=ld(a.pop);a.mesh.visible=o<1,a.mesh.position.set(a.sx,r.R*.62,a.sy);let l=1+o*.6;a.mesh.scale.set(1.25*l,.55*(1-o),1.15*l),a.mesh.material.opacity=.95*(1-o)}}if(e==="proof"){this.loaf.proof=ce(this.loaf.proof+t/3,0,1),this.loaf.rebuild();for(let r of this.sibs)r.proof=this.loaf.proof,r.rebuild();this.loaf.proof>=1&&this.stageT>3.8&&this._advance()}if(e==="load"&&(this.slideK>0&&this.slideK<1&&(this.slideK=Math.min(1,this.slideK+t*.62),this.slideK>=1&&(ae.door(!1),setTimeout(()=>{this.stage==="load"&&this._advance()},420))),this.heat=Sn(this.heat,.55,1.6,t)),e==="steam"&&(this.heat=Sn(this.heat,.72,1.4,t),this.steamK>0&&(this.steamK=Math.min(1,this.steamK+t*.8))),e==="bake"){this.bakeT+=t;let r=ce(this.bakeT/C_,0,1);this.loaf.bake=1-Math.pow(1-r,1.32),this.loaf.rebuild();for(let l of this.sibs)l.bake=this.loaf.bake,l.rebuild();this.heat=Sn(this.heat,1,1,t);let a=oi(26,1.2,ld(P_(r,0,.55))),o=t*a;for(;o>0;){if(Math.random()<Math.min(1,o)){let l=Math.random()<.55,c=this.loafGroup.position;l?this.parts.steam(c.x+Le(-.3,.3),c.y+Le(0,.05),c.z+Le(-.12,.12),1,.75,.8):this.parts.steam(re.oven.x+Le(-.55,.55),wt.deckY+Le(0,.2),re.oven.z+Le(-.4,.4),1,1.1,.9)}o-=1}for(let l of this.loaf.consumePops()){ae.pop(.85+Math.random()*.2);let c=this.loaf.dims(),h=this.loafGroup.position,d=(l.t*2-1)*c.hl;this.parts.steam(h.x+d,h.y+c.R,h.z+l.off,3,.5,.7),this.parts.spark(h.x+d,h.y+c.R,h.z+l.off,4,1)}r>.72&&(this.crackleT-=t,this.crackleT<=0&&(ae.crackle(.7),this.crackleT=Le(.1,.4))),r>=1&&(ae.chime("big"),ae.ovenHum(!1),setTimeout(()=>{this.stage==="bake"&&this._advance()},900))}if(e==="out"&&(this.heat=Sn(this.heat,.3,.9,t),this.slideK>0&&this.slideK<1&&(this.slideK=Math.min(1,this.slideK+t*.6),this.slideK>=1&&setTimeout(()=>{this.stage==="out"&&this._advance()},500)),this.slideK>.2)){let r=this.loafGroup.position;Math.random()<t*9&&this.parts.steam(r.x+Le(-.28,.28),r.y+.03,r.z,1,.4,.5),this.crackleT-=t,this.crackleT<=0&&(ae.crackle(.85),this.crackleT=Le(.08,.32))}if(e==="tap"||e==="done")if(this.heat=Sn(this.heat,.16,.6,t),this.loaf.cool=ce(this.loaf.cool+t/7,0,1),e==="tap"){this.crackleT-=t,this.crackleT<=0&&(ae.crackle(.4),this.crackleT=Le(.5,1.6));let r=this.loafGroup.position;Math.random()<t*2.4&&this.parts.steam(r.x+Le(-.28,.28),r.y+.02,r.z,1,.3,.4)}else this.celebrateT+=t;(e==="menu"||e==="place"||e==="press"||e==="roll"||e==="stretch")&&(this.heat=Sn(this.heat,.2,.5,t));let n=["load","steam","bake","out"].includes(e)?e==="load"?ce(this.slideK*4,0,1):e==="out"?1-Os(ce(this.slideK*1.4-.4,0,1))*0+1:1:0;if(this.doorK=Sn(this.doorK,n,4,t),this.ovenDoor.rotation.x=-this.doorK*1.62,this.peel.visible=e==="load"&&this.slideK<.98,this.peel.visible){let r=Os(this.slideK);this.peel.position.set(oi(re.couche.x,re.oven.x,r),oi(wt.benchTop+.02,wt.deckY+.004,r),oi(re.peelWait.z+.1,re.oven.z+.3,r)),this.peel.rotation.set(0,0,0)}this.rack.visible=["out","tap","done"].includes(e),this.bubbleGroup.visible=e==="press",this.stage3.setOvenHeat(this.heat);let s=["load","steam","bake","out"].includes(e)?ce(this.heat*1.25,0,1):0;this.interior=Sn(this.interior||0,s,2.2,t),this.stage3.setInterior(this.interior),this.parts.update(t),this._placeLoaf(t),this._updateCamera(t)}_layoutHud(){let t=this.W,e=this.H,n=this.mn,s=this.portrait,r=ce(n*.055,22,46),a=ce(n*.095,40,92),o=this.buttons;o.sound={x:t-r*1.5,y:r*1.5,r,icon:this.soundOn?"sound":"mute"},o.home={x:t-r*1.5,y:r*4,r,icon:"home"},o.go={x:t-a*1.3,y:e-a*1.5,r:a,icon:"arrowR",pulse:!0,color:["#fff0d8","#ffd9a5"],ring:"rgba(214,112,50,0.92)"},o.steam={x:t*.5,y:s?e*.88:e*.86,r:a*1.1,icon:"steam",pulse:!0,color:["#eefaff","#c8e8f8"],ring:"rgba(90,160,205,0.92)"};let l=["normal","petite","batard","free"],c={normal:"baguette",petite:"petite",batard:"batard",free:"sparkleLame"},h=ce(n*(s?.15:.125),44,128);o.menu=l.map((u,f)=>({x:s?t*(f%2===0?.29:.71):t*(.155+.23*f),y:s?e*(f<2?.58:.8):e*.78,r:h,icon:c[u],key:u,pulse:!0,color:u==="free"?["#fff2fb","#ffd9ee"]:["#fdf3e2","#efd9b8"],ring:u==="free"?"rgba(214,110,170,0.92)":"rgba(198,120,70,0.9)"}));let d=ce(n*(s?.13:.11),40,106);o.done=[{key:"same",icon:c[this.typeKey]||"baguette"},{key:"other",icon:"three"},{key:"free",icon:"sparkleLame",color:["#fff2fb","#ffd9ee"],ring:"rgba(214,110,170,0.92)"}].map((u,f)=>Object.assign({x:s?t*(.2+.3*f):t*(.31+.19*f),y:s?e*.86:e*.84,r:d,pulse:!0},u))}_activeButtons(){let t=[this.buttons.sound],e=this.stage;return e!=="menu"&&t.push(this.buttons.home),e==="menu"&&t.push(...this.buttons.menu),e==="done"&&t.push(...this.buttons.done),e==="score"&&this.loaf&&this.loaf.scores.length>=(this.freeMode?2:3)&&(this.buttons.go.icon="oven",this.buttons.go.badge=this.loaf.scores.length,t.push(this.buttons.go)),e==="proof"&&this.loaf&&this.loaf.proof>.9&&(this.buttons.go.icon="lame",this.buttons.go.badge=0,t.push(this.buttons.go)),(e==="load"||e==="out")&&this.slideK<=0&&(this.buttons.go.icon="arrowR",this.buttons.go.badge=0,t.push(this.buttons.go)),e==="steam"&&this.steamK<=0&&t.push(this.buttons.steam),t}_hudDown(t,e){for(let n of this._activeButtons())if(he.hit(n,t,e))return n.press=!0,this.pressed=n,!0;return!1}_hudUp(t,e){let n=this.pressed;if(this.pressed=null,!!n&&(n.press=!1,!!he.hit(n,t,e,12))){if(ae.tapUI(),n===this.buttons.sound){this.soundOn=!this.soundOn,ae.setEnabled(this.soundOn),n.icon=this.soundOn?"sound":"mute";return}if(n===this.buttons.home){this.setStage("menu");return}if(this.stage==="menu"&&n.key){this.newLoaf(n.key);return}if(this.stage==="done"){n.key==="same"?this.newLoaf(this.typeKey):n.key==="free"?this.newLoaf("free"):this.setStage("menu");return}if(n===this.buttons.go){this.stage==="score"||this.stage==="proof"?this._advance():this.stage==="load"?this._startLoad():this.stage==="out"&&this._startOut();return}n===this.buttons.steam&&this._doSteam()}}_project(t){let e=t.clone().project(this.camera);return{x:(e.x*.5+.5)*this.W,y:(-e.y*.5+.5)*this.H,z:e.z}}drawHud(){let t=this.hctx,e=this.W,n=this.H,s=this.time;t.setTransform(this.dpr,0,0,this.dpr,0,0),t.clearRect(0,0,e,n),he.trail(t,this.trail,this.mn),this._drawHints(t);for(let a of this._activeButtons())he.button(t,a,s);let r=Ji.indexOf(this.stage);r>=0&&he.steps(t,e,n,r,Ji.length),this.stage==="done"&&(he.steps(t,e,n,Ji.length-1,Ji.length),this.celebrateT<3.2&&(t.save(),t.globalAlpha=ce(1-(this.celebrateT-2.2)/1,0,1),he.celebrate(t,e,n,this.celebrateT),t.restore()))}_drawHints(t){if(this.idleT<.8||this.stage==="menu"||this.stage==="done")return;let e=ce((this.idleT-.8)/.6,0,1),n=this.stage,s=this.time,r=this.mn/420,a=this.loaf;if(!a)return;let o=a.dims(),l=this.loafGroup.position,c=(h,d,u)=>this._project(new I(h,d,u));if(t.save(),t.globalAlpha=e,n==="place"&&this.dropK<=0){let h=c(re.bench.x,wt.benchTop,re.bench.z);he.hintTap(t,h.x,h.y,s,r)}else if(n==="press"){let h=this.bubbles.find(d=>d.pop<=0);if(h){let d=c(l.x+h.sx,l.y+o.R,l.z+h.sy);he.hintTap(t,d.x,d.y,s,r)}}else if(n==="roll"){let h=c(l.x,l.y+o.R,l.z+o.R*2.6),d=c(l.x,l.y+o.R,l.z-o.R*2.6);he.hintSwipe(t,h.x,h.y,d.x,d.y,s,r)}else if(n==="stretch"){let h=c(l.x-o.hl*1.15,l.y+o.R,l.z),d=c(l.x+o.hl*1.15,l.y+o.R,l.z);Math.floor(s*.62)%2?he.hintSwipe(t,h.x,h.y,d.x,d.y,s,r):he.hintSwipe(t,d.x,d.y,h.x,h.y,s,r)}else if(n==="couche"){let h=c(l.x,l.y+o.R,l.z),d=c(re.couche.x,wt.benchTop+.05,re.couche.z);he.hintSwipe(t,h.x,h.y,d.x,d.y,s,r)}else if(n==="score"){let h=a.scores.length;if(h<5){let u=((.22+h*.18)*2-1)*o.hl,f=(h?a.lean:-1)*.36,m=.22*o.hl,y=c(l.x+u-Math.cos(f)*m,l.y+o.R*.9,l.z-Math.sin(f)*m),p=c(l.x+u+Math.cos(f)*m,l.y+o.R*.9,l.z+Math.sin(f)*m);he.hintSwipe(t,y.x,y.y,p.x,p.y,s,r)}}else if(n==="load"&&this.slideK<=0){let h=c(l.x,l.y+o.R,l.z),d=c(re.oven.x,wt.mouthY,wt.ovenFront+.05);he.hintSwipe(t,h.x,h.y,d.x,d.y,s,r)}else if(n==="out"&&this.slideK<=0){let h=c(l.x,l.y+o.R,l.z);he.hintSwipe(t,h.x,h.y-this.H*.02,h.x,h.y+this.H*.3,s,r)}else if(n==="tap"){let h=c(l.x,l.y+o.R,l.z);he.hintTap(t,h.x,h.y,s,r*1.2)}t.restore()}resize(t,e,n){this.W=t,this.H=e,this.dpr=n,this.mn=Math.min(t,e),this.portrait=e>=t*1.02,this.hudCanvas.width=Math.round(t*n),this.hudCanvas.height=Math.round(e*n),this.stage3.resize(t,e,n),this._layoutHud(),this._applyCamTarget(!0),this._updateCamera(1)}render(){this.stage3.render(),this.drawHud()}};function cd(){let i=document.getElementById("gl"),t=document.getElementById("hud"),e=new qo(i,t);window.Game=e;function n(){let a=Math.round(document.documentElement.clientWidth),o=Math.round(window.innerHeight);if(!a||!o)return;let l=Math.min(window.devicePixelRatio||1,2);i.style.width=a+"px",i.style.height=o+"px",t.style.width=a+"px",t.style.height=o+"px",e.resize(a,o,l)}window.addEventListener("resize",n),window.addEventListener("orientationchange",()=>setTimeout(n,140)),window.visualViewport&&window.visualViewport.addEventListener("resize",n),n();let s=0;function r(a){s||(s=a);let o=(a-s)/1e3;s=a,o=Math.max(0,Math.min(o,.05)),e.paused||(e.update(o),e.render()),requestAnimationFrame(r)}requestAnimationFrame(r),document.body.classList.add("ready")}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",cd):cd();})();
