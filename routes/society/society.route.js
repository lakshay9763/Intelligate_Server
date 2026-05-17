const express = require('express');
const { Resident } = require('../../model/resident.model');

const societyRoute = express.Router();

// ==========================================
// Society Structure Endpoints
// ==========================================

societyRoute.get('/phase', async (req, res, next) => {
  try {
    const phases = await Resident.distinct("phase");
    
    res.status(200).json({ success: true, data: phases });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error fetching phases' });
  }
});

societyRoute.get('/blocks', async (req, res, next) => {
  try {
    const { phase } = req.query;

    const blocks = await Resident.aggregate([
      { $match: { phase } },
      {
        $group: {
          _id: {
            block: "$block",
            familyId: "$familyId"
          }
        }
      },
      {
        $group: {
          _id: "$_id.block",
          occupied: { $sum: 1 }
        }
      }
    ]);

    const result = blocks.map(b => ({
      block: b._id,
      occupied: b.occupied
    }));

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error fetching blocks' });
  }
});

societyRoute.get('/plots', async (req, res, next) => {
  try {
    const { phase, block } = req.query;

    const plots = await Resident.aggregate([
      { $match: { phase, block } },
      {
        $group: {
          _id: {
            plot: "$plot",
            familyId: "$familyId"
          }
        }
      },
      {
        $group: {
          _id: "$_id.plot",
          occupied: { $sum: 1 }
        }
      }
    ]);

    const result = plots.map(p => ({
      plot: p._id,
      occupied: p.occupied
    }));

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error fetching plots' });
  }
});

societyRoute.get('/floors', async (req, res, next) => {
  try {
    const { phase, block, plot } = req.query;

    const families = await Resident.aggregate([
      { $match: { phase, block, plot } },
      {
        $group: {
          _id: "$floor",
          familyId: { $first: "$familyId" }
        }
      }
    ]);

    const ALL = ["1st", "2nd", "3rd", "4th"];

    const result = ALL.map(f => {
      const found = families.find(x => x._id === f);
      return {
        floor: f,
        occupied: !!found
      };
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error fetching floors' });
  }
});

// ==========================================
// Occupation Status Endpoints
// ==========================================

societyRoute.get('/occupation-status', async (req, res, next) => {
  try {
    const { derivedFlat } = req.query;

    const existingFamily = await Resident.findOne({ familyId: derivedFlat });

    if (!existingFamily) {
      return res.status(200).json({
        success: true,
        occupied: false,
        message: 'Flat available'
      });
    }

    return res.status(200).json({
      success: true,
      occupied: true,
      message: 'Flat already occupied',
      data: existingFamily
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = societyRoute;