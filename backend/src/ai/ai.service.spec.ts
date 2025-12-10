import { NotFoundException } from '@nestjs/common';
import { AiService } from './ai.service';

describe('AiService', () => {
  const mockGemini: any = { generateText: jest.fn() };
  const mockPrisma: any = { incident: { findUnique: jest.fn() } };

  const svc = new AiService(mockGemini as any, mockPrisma as any);

  beforeEach(() => jest.clearAllMocks());

  it('throws when incident not found', async () => {
    mockPrisma.incident.findUnique.mockResolvedValue(null);
    await expect(svc.generateIncidentSummary('i1')).rejects.toThrow(NotFoundException);
  });

  it('generates and parses summary', async () => {
    const incident = {
      id: 'i1', refId: 'INC-1', title: 'T', severity: 'HIGH', status: 'RESOLVED', description: 'D',
      timeline: [{ timestamp: new Date().toISOString(), type: 'STATUS_CHANGE', message: 'm' }]
    };
    mockPrisma.incident.findUnique.mockResolvedValue(incident);
    mockGemini.generateText.mockResolvedValue('----\nSummary text\n\nRoot cause: something\n----');

    const res = await svc.generateIncidentSummary('i1');
    expect(mockGemini.generateText).toHaveBeenCalled();
    expect(res).toMatch(/Summary text/);
    expect(res).toMatch(/Root cause/);
  });
});
