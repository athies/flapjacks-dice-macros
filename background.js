import OBR from "https://esm.sh/@owlbear-rodeo/sdk@2.0.0";

const BROADCAST_CHANNEL = "com.twobarkdesign.flapjack-macros.roll";

OBR.onReady(() => {
  OBR.broadcast.onMessage(BROADCAST_CHANNEL, (event) => {
    if (!event || !event.data) return;
    const {
      rollerName = "A player",
      formulaText = "",
      breakdownText = "",
      variant = "WARNING"
    } = event.data;

    // Trigger the notification banner for this player
    OBR.notification.show(`${rollerName} rolled ${formulaText}: ${breakdownText}`, variant);
  });
});
