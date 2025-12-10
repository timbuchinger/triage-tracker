import { ServicesService } from './services.service';

describe('ServicesService', () => {
  const mockPrisma: any = { service: { findMany: jest.fn(), create: jest.fn(), delete: jest.fn() } };
  const svc = new ServicesService(mockPrisma as any);

  beforeEach(() => jest.clearAllMocks());

  it('findAll forwards to prisma.service.findMany', async () => {
    mockPrisma.service.findMany.mockResolvedValue([{ id: 's1' }]);
    const res = await svc.findAll();
    expect(res).toEqual([{ id: 's1' }]);
    expect(mockPrisma.service.findMany).toHaveBeenCalled();
  });

  it('create calls prisma.service.create with org placeholder', async () => {
    mockPrisma.service.create.mockResolvedValue({ id: 's2', name: 'n' });
    const res = await svc.create({ name: 'n' } as any);
    expect(mockPrisma.service.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: 'n' }) }));
    expect(res).toEqual({ id: 's2', name: 'n' });
  });

  it('delete calls prisma.service.delete', async () => {
    mockPrisma.service.delete.mockResolvedValue({});
    await svc.delete('id1');
    expect(mockPrisma.service.delete).toHaveBeenCalledWith({ where: { id: 'id1' } });
  });
});
