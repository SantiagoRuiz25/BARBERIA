import{Jt as h,_t as Wk,ft as UE,gt as WE,un as me}from"./chunk-BCli3xsi.js";var a;var u=h(()=>{WE();UE();a=class i{BUSINESS_WHATSAPP=`573165033984`;goToCheckout(n){window.location.assign(n)}async getStatus(n){try{let e=await fetch(`${Wk}/payments/status/${encodeURIComponent(n)}`);return e.ok?await e.json():null}catch{return null}}async confirm(n,e){try{let t=await fetch(`${Wk}/payments/confirm`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({id:n,transactionId:e})});return t.ok?await t.json():null}catch{return null}}async retryCheckout(n){try{let e=await fetch(`${Wk}/appointments/${encodeURIComponent(n)}/checkout`,{method:`POST`}),t=await e.json().catch(()=>({}));return e.ok?{checkoutUrl:t.checkoutUrl}:{error:t.error??`No se pudo generar el pago.`}}catch{return{error:`No pudimos conectar con el servidor. Revisa tu conexión.`}}}money(n){return`$`+n.toLocaleString(`es-CO`)}generateWhatsAppConfirmation(n){let e=n.totalAmount-n.paidAmount,t=n.paidAmount>0?`\u{1F4B0} *Se\xF1a pagada:* ${this.money(n.paidAmount)}
\u{1F4B5} *Restante en el local:* ${this.money(e)}

`:`\u{1F4B5} *Total a pagar en el local:* ${this.money(n.totalAmount)}

`,s=encodeURIComponent(`\u{1F488} *\xA1Bienvenido a Estudio 4-4-4 Barber!*
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u2705 *Turno Confirmado*

\u{1F4CB} *C\xF3digo de reserva:* ${n.bookingCode}

\u{1F464} *Barbero:* ${n.barberName}
\u{1F488} *Servicio:* ${n.serviceName}
\u{1F4C5} *Fecha:* ${n.date}
\u{1F552} *Hora:* ${n.time}

`+t+`\u{1F4CD} Yopal, Casanare
\u{1F4F1} 316 503 3984

\xA1Te esperamos! M\xE1s que un corte, es confianza. \u2728`);return`https://wa.me/${n.clientWhatsapp.replace(/\D/g,``)}?text=${s}`}generateBusinessNotification(n){let e=encodeURIComponent(`\u{1F514} *\xA1Nuevo turno en Estudio 4-4-4 Barber!*

\u{1F4CB} *C\xF3digo:* ${n.bookingCode}
\u{1F464} *Cliente:* ${n.clientName}
\u{1F4F1} *WhatsApp:* ${n.clientWhatsapp}

\u{1F488} *Servicio:* ${n.serviceName}
\u{1F4C5} *Fecha:* ${n.date}
\u{1F552} *Hora:* ${n.time}

\u{1F4B0} *Total:* ${this.money(n.totalAmount)}
\u2705 *Pagado en l\xEDnea:* ${this.money(n.paidAmount)}`);return`https://wa.me/${this.BUSINESS_WHATSAPP}?text=${e}`}openWhatsAppConfirmation(n){window.open(this.generateWhatsAppConfirmation(n),`_blank`)}openBusinessNotification(n){window.open(this.generateBusinessNotification(n),`_blank`)}static ɵfac=function(e){return new(e||i)};static ɵprov=me({token:i,factory:i.ɵfac,providedIn:`root`})}});export{u as n,a as t};