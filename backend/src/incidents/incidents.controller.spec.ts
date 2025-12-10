import { IncidentsController } from './incidents.controller';

describe('IncidentsController', () => {
  const svc = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    addTimelineEvent: jest.fn(),
    addSummary: jest.fn(),
    generateSummary: jest.fn(),
    updateSummary: jest.fn()
  };

  const ctrl = new IncidentsController(svc as any);

  beforeEach(() => jest.clearAllMocks());

  it('findAll delegates', () => {
    (svc.findAll as jest.Mock).mockReturnValue([]);
    expect(ctrl.findAll({} as any, { id: 'test-user' } as any)).toEqual([]);
  });

  it('findOne delegates', () => {
    (svc.findOne as jest.Mock).mockReturnValue({ refId: 'INC-1' });
    expect(ctrl.findOne('INC-1')).toEqual({ refId: 'INC-1' });
  });

  it('create delegates', async () => {
    (svc.create as jest.Mock).mockResolvedValue({ refId: 'INC-2' });
    expect(await ctrl.create({} as any, { id: 'test-user' } as any)).toEqual({ refId: 'INC-2' });
  });

  it('update delegates', () => {
    (svc.update as jest.Mock).mockReturnValue({});
    expect(ctrl.update('r', {} as any)).toEqual({});
  });

  it('addEvent delegates', () => {
    (svc.addTimelineEvent as jest.Mock).mockReturnValue({});
    expect(ctrl.addEvent('r', {} as any)).toEqual({});
  });

  it('addSummary delegates', () => {
    (svc.addSummary as jest.Mock).mockReturnValue({});
    expect(ctrl.addSummary('r', {} as any)).toEqual({});
  });

  it('generateSummary delegates', () => {
    (svc.generateSummary as jest.Mock).mockReturnValue({});
    expect(ctrl.generateSummary('r')).toEqual({});
  });

  it('updateSummary delegates', () => {
    (svc.updateSummary as jest.Mock).mockReturnValue({});
    expect(ctrl.updateSummary('r', 's', { content: 'x' } as any)).toEqual({});
  });
});
