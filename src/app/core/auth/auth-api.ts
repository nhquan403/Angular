import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config';
import { TokenResponse, User } from '../models';

/** Gọi các endpoint /api/auth/* của BE (AuthController). Không chứa logic, chỉ là lời gọi HTTP. */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/api/auth`;

  register(email: string, password: string): Observable<User> {
    return this.http.post<User>(`${this.url}/register`, { email, password });
  }

  login(email: string, password: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.url}/login`, { email, password });
  }

  refresh(refreshToken: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.url}/refresh`, { refreshToken });
  }

  logout(refreshToken: string): Observable<void> {
    return this.http.post<void>(`${this.url}/logout`, { refreshToken });
  }

  me(): Observable<User> {
    return this.http.get<User>(`${this.url}/me`);
  }
}
