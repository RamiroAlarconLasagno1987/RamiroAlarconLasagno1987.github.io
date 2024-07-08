export function solicitarPermisoNotificaciones() {
    if ("Notification" in window) {
        Notification.requestPermission().then(permiso => {
            if (permiso === "granted") {
                console.log("Permiso de notificación concedido");
            } else {
                console.log("Permiso de notificación denegado");
            }
        });
    }
}

export function enviarNotificacion(titulo, cuerpo) {
    new Notification(titulo, {
        body: cuerpo,
        icon: 'icon_url'
    });
}
