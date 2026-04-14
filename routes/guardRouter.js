const express = require('express');
const { Passes, Passes_Info } = require('../model/passModel');
const {Worker2Resident} = require('../model/residentModel')
const guardRoute = express.Router()

const {PersonalStaff} = require('../model/passModel');
const { updateLocationStatusController } = require('../controller/guardController');

guardRoute.get('/getUpcomingPasses', async (req, res, next) => {
    console.log(req.query, 'Hello brother')

    if (req.query.guardId === 'Guard-01') {
        const passes = await Passes.aggregate([
            {
                $match: { status: "Pending" }
            },
            {
                $lookup: {
                    from: "passes_infos",     // ✅ second collection name
                    localField: "passId",
                    foreignField: "passId",
                    as: "visitorInfo"
                }
            },
            {
                $unwind: "$visitorInfo"
            },
            {
                $project: {
                    _id: 0,
                    passId: 1,
                    flatNumber: 1,
                    visitorName: "$visitorInfo.visitorName",
                    visitorCount: "$visitorInfo.visitorCount",
                    visitDate: "$visitorInfo.visitDate"
                }
            }
        ]);

        console.log(passes)

        res.status(200).json(passes)
    }
})

guardRoute.get('/getAllStaff',async  (req,res,next)=>{
    console.log(req.query)

    const rest = await PersonalStaff.find({status:'active'})

    console.log(rest,'helll')

    res.status(200).json(rest)

    

})

guardRoute.post('/updateLocationStatus', updateLocationStatusController);

exports.guardRoute = guardRoute