const {
  getAllSettings,
  getSetting,
} = require('./globalSettings.controller');
const GlobalSetting = require('../models/GlobalSetting');

// Mock dependencies
jest.mock('../models/GlobalSetting');

describe('GlobalSettings Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {
      params: {},
      body: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('getAllSettings', () => {
    it('should return all settings', async () => {
      const settings = [{
        key: 'setting1',
        value: 'value1'
      }, {
        key: 'setting2',
        value: 'value2'
      }];
      GlobalSetting.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(settings),
      });

      await getAllSettings(mockReq, mockRes);

      expect(GlobalSetting.find).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(settings);
    });

    it('should handle errors', async () => {
      GlobalSetting.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error('DB Error')),
      });

      await getAllSettings(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to fetch global settings'
      });
    });
  });

  describe('getSetting', () => {
    it('should return a specific setting', async () => {
      const setting = {
        key: 'setting1',
        value: 'value1'
      };
      mockReq.params.key = 'setting1';
      GlobalSetting.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(setting),
      });

      await getSetting(mockReq, mockRes);

      expect(GlobalSetting.findOne).toHaveBeenCalledWith({
        key: 'setting1'
      });
      expect(mockRes.json).toHaveBeenCalledWith(setting);
    });

    it('should return 404 if setting not found', async () => {
      mockReq.params.key = 'nonexistent';
      GlobalSetting.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      await getSetting(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Setting with key 'nonexistent' not found."
      });
    });
  });
});