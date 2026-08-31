// Shared between the client (main.js) and the server (server.js). Fixed
// (not random) so every client generates identical terrain, and the
// server's own authoritative World (used for multiplayer catch-up) agrees
// with them — if this value ever drifted between client and server,
// catch-up data sent to new joiners would silently paint the wrong
// terrain under their feet.
const SHARED_WORLD_SEED = 1337;

export { SHARED_WORLD_SEED };
