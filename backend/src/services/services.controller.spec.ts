import { ServicesController } from './services.controller';

describe('ServicesController', () => {
  const svc = { findAll: jest.fn(), findOne: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() };
  const linkSvc = { findByServiceId: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() };
  const ctrl = new ServicesController(svc as any, linkSvc as any);

  beforeEach(() => jest.clearAllMocks());

  it('findAll delegates', () => {
    (svc.findAll as jest.Mock).mockReturnValue([]);
    expect(ctrl.findAll()).toEqual([]);
  });

  it('create delegates', () => {
    (svc.create as jest.Mock).mockReturnValue({ id: 's1' });
    expect(ctrl.create({ name: 'n' } as any)).toEqual({ id: 's1' });
  });

  it('delete delegates', () => {
    (svc.delete as jest.Mock).mockReturnValue({});
    expect(ctrl.delete('id1')).toEqual({});
  });
});
