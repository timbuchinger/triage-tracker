import { Reflector } from '@nestjs/core';
import { Public, IS_PUBLIC_KEY } from './public.decorator';

describe('Public Decorator', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  it('should set isPublic metadata to true', () => {
    class TestController {
      @Public()
      testMethod() {}
    }

    const isPublic = reflector.get<boolean>(IS_PUBLIC_KEY, TestController.prototype.testMethod);
    expect(isPublic).toBe(true);
  });

  it('should work on class level', () => {
    @Public()
    class TestController {}

    const isPublic = reflector.get<boolean>(IS_PUBLIC_KEY, TestController);
    expect(isPublic).toBe(true);
  });

  it('should export IS_PUBLIC_KEY constant', () => {
    expect(IS_PUBLIC_KEY).toBe('isPublic');
  });

  it('should not affect other methods without decorator', () => {
    class TestController {
      @Public()
      publicMethod() {}

      protectedMethod() {}
    }

    const isPublic = reflector.get<boolean>(IS_PUBLIC_KEY, TestController.prototype.publicMethod);
    const isProtected = reflector.get<boolean>(IS_PUBLIC_KEY, TestController.prototype.protectedMethod);
    
    expect(isPublic).toBe(true);
    expect(isProtected).toBeUndefined();
  });
});
