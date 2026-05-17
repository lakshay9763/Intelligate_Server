
const { Server } = require("socket.io");

let io

// mapping object
const gateSockets = {}; 
// {
//   Guard-01 : socketId123,
//   Guard-02 : socketId456
// }



const initSocket = (server)=>{


    io = new Server(server,{
    cors:{origin:"*"}
  });

  io.on("connection",(socket)=>{

    console.log("User connected:",socket.id);


    socket.on("registorGateDevice",(deviceId)=>{

      console.log(deviceId,'q------------------------------')
        gateSockets[deviceId] = socket.id

        console.log("Guard Registered:",deviceId);
        console.log(gateSockets)
    })

    

   socket.on("disconnect",()=>{
   console.log("Disconnected:", socket.id);
});

  })
}


const getIO = ()=> io;
const getGateDeviceSocketId = (deviceId)=> gateSockets[deviceId];
const getGateDeviceAllSocketId = () => gateSockets
module.exports = { initSocket, getIO, getGateDeviceSocketId,getGateDeviceAllSocketId };